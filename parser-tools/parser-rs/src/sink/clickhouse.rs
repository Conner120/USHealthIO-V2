//! ClickHouse sink: streams parsed rates straight into MergeTree tables using the official
//! `clickhouse` crate (HTTP + RowBinary + LZ4). See `clickhouse-schema/schema.sql` at the repo root.
//!
//! Ingest strategy, tuned for bulk load:
//!   * Every parser worker owns a `ClickHouseWriter` with its own `Inserter`s, so N workers means
//!     N concurrent INSERT streams — the server parallelises part building across them.
//!   * Rows are written as soon as an element is parsed; nothing is buffered in the parser.
//!   * Each `INSERT` is bounded by `CLICKHOUSE_INSERT_MAX_ROWS` / `_MAX_BYTES`, so ClickHouse creates
//!     one large part per statement instead of thousands of tiny parts (which stalls merges).
//!   * Row structs borrow from the parsed objects (`&str`, `&[String]`) — no per-row allocation.
//!   * `insurance_scan_job_id` is the first ORDER BY column; everything for one job lands in a
//!     contiguous key range, which keeps the sparse index tight and makes per-job queries cheap.

use crate::allowlist::{classify, Verdict};
use crate::config::{ClickHouseConfig, CompressionKind, ZombieFilter};
use crate::model::{FileHeader, InNetworkObject, ProviderReferenceObject};
use chrono::NaiveDate;
use clickhouse::inserter::Inserter;
use clickhouse::{Client, Compression, Row};
use serde::Serialize;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;

/// Date32 upper bound (ClickHouse cannot represent the `9999-12-31` "never expires" sentinel
/// that many carriers use). Anything past it is clamped here so it still sorts as "far future".
const DATE32_MAX: NaiveDate = match NaiveDate::from_ymd_opt(2299, 12, 31) {
    Some(d) => d,
    None => unreachable!(),
};

/// One row per negotiated price × provider_group_id. Join to `provider_groups` on
/// (insurance_scan_job_id, provider_group_id) to expand to TIN/NPI.
#[derive(Row, Serialize)]
struct RateRow<'a> {
    insurance_scan_job_id: &'a str,
    provider_group_id: i64,
    negotiation_arrangement: &'a str,
    billing_code_type: &'a str,
    billing_code_type_version: &'a str,
    billing_code: &'a str,
    name: &'a str,
    description: &'a str,
    severity_of_illness: &'a str,
    negotiated_type: &'a str,
    negotiated_rate: Option<f64>,
    #[serde(with = "clickhouse::serde::chrono::date32::option")]
    expiration_date: Option<NaiveDate>,
    service_code: &'a [String],
    billing_class: &'a str,
    setting: &'a str,
    billing_code_modifier: &'a [String],
    additional_information: &'a [String],
    /// Structural plausibility verdict from `allowlist::classify` ('ALLOW' | 'REVIEW' | 'DENY').
    zombie_verdict: &'a str,
    /// Rule id that produced the verdict ('ok' when nothing fired).
    zombie_rule: &'a str,
}

/// One row per (provider_group_id, TIN). NPIs stay as an array; `provider_group_npi` (a
/// materialized view in the schema) flattens them for NPI-first lookups.
#[derive(Row, Serialize)]
struct ProviderGroupRow<'a> {
    insurance_scan_job_id: &'a str,
    provider_group_id: i64,
    network_name: &'a [String],
    tin_type: &'a str,
    tin_value: &'a str,
    business_name: &'a str,
    npi: &'a [i64],
}

#[derive(Row, Serialize)]
struct FileRow<'a> {
    insurance_scan_job_id: &'a str,
    reporting_entity_name: &'a str,
    reporting_entity_type: &'a str,
    issuer_name: &'a str,
    plan_name: &'a str,
    plan_id_type: &'a str,
    plan_id: &'a str,
    plan_sponsor_name: &'a str,
    plan_market_type: &'a str,
    version: &'a str,
    provider_reference_count: u64,
    in_network_count: u64,
    rate_row_count: u64,
}

#[derive(Debug)]
pub struct ClickHouseError(pub String);

fn ch_err(context: &str, e: clickhouse::error::Error) -> ClickHouseError {
    ClickHouseError(format!("clickhouse {}: {}", context, e))
}

fn opt(s: &Option<String>) -> &str {
    s.as_deref().unwrap_or("")
}

fn verdict_str(v: Verdict) -> &'static str {
    match v {
        Verdict::Allow => "ALLOW",
        Verdict::Review => "REVIEW",
        Verdict::Deny => "DENY",
    }
}

fn parse_expiration(s: &Option<String>) -> Option<NaiveDate> {
    let s = s.as_deref()?.trim();
    // MRF dates are `YYYY-MM-DD`; tolerate a trailing time component just in case.
    let date_part = s.get(..10).unwrap_or(s);
    NaiveDate::parse_from_str(date_part, "%Y-%m-%d")
        .ok()
        .map(|d| d.min(DATE32_MAX))
}

/// Shared connection; cheap to clone into every worker.
#[derive(Clone)]
pub struct ClickHouseSink {
    client: Client,
    cfg: Arc<ClickHouseConfig>,
    job_id: Arc<str>,
    /// Completed INSERT statements across all writers.
    statements: Arc<AtomicU64>,
}

impl ClickHouseSink {
    pub async fn connect(cfg: &ClickHouseConfig, job_id: &str) -> Result<ClickHouseSink, ClickHouseError> {
        let mut client = Client::default()
            .with_url(cfg.url.as_str())
            .with_database(cfg.database.as_str())
            .with_user(cfg.user.as_str())
            .with_password(cfg.password.as_str())
            .with_compression(match cfg.compression {
                CompressionKind::None => Compression::None,
                CompressionKind::Lz4 => Compression::Lz4,
                CompressionKind::Zstd(level) => Compression::Zstd(level),
            })
            .with_validation(cfg.validate_schema);
        for (k, v) in &cfg.extra_settings {
            client = client.with_setting(k.as_str(), v.as_str());
        }
        // Fail fast on bad credentials / unreachable host instead of after parsing a 50 GB file.
        client
            .query("SELECT 1")
            .execute()
            .await
            .map_err(|e| ch_err("connection check", e))?;
        Ok(ClickHouseSink {
            client,
            cfg: Arc::new(cfg.clone()),
            job_id: Arc::from(job_id),
            statements: Arc::new(AtomicU64::new(0)),
        })
    }

    pub fn statements(&self) -> u64 {
        self.statements.load(Ordering::Relaxed)
    }

    pub fn writer(&self, zombie_filter: ZombieFilter) -> ClickHouseWriter {
        ClickHouseWriter {
            rates: self.inserter::<RateRow<'static>>(&self.cfg.table_rates),
            groups: self.inserter::<ProviderGroupRow<'static>>(&self.cfg.table_provider_groups),
            job_id: self.job_id.clone(),
            zombie_filter,
            rate_rows: 0,
            group_rows: 0,
            zombie_skipped: 0,
        }
    }

    fn inserter<T: Row>(&self, table: &str) -> Inserter<T> {
        let statements = self.statements.clone();
        self.client
            .inserter::<T>(table)
            .with_max_rows(self.cfg.insert_max_rows)
            .with_max_bytes(self.cfg.insert_max_bytes)
            .with_period(self.cfg.insert_period)
            .with_timeouts(self.cfg.send_timeout, self.cfg.end_timeout)
            .with_commit_callback(move |q| {
                if q.rows > 0 {
                    statements.fetch_add(1, Ordering::Relaxed);
                }
            })
    }

    pub async fn file_meta(
        &self,
        meta: &FileHeader,
        provider_reference_count: u64,
        in_network_count: u64,
        rate_row_count: u64,
    ) -> Result<(), ClickHouseError> {
        let mut insert = self
            .client
            .insert::<FileRow<'static>>(self.cfg.table_files.as_str())
            .await
            .map_err(|e| ch_err("begin mrf_files insert", e))?;
        insert
            .write(&FileRow {
                insurance_scan_job_id: &self.job_id,
                reporting_entity_name: &meta.reporting_entity_name,
                reporting_entity_type: &meta.reporting_entity_type,
                issuer_name: opt(&meta.issuer_name),
                plan_name: opt(&meta.plan_name),
                plan_id_type: opt(&meta.plan_id_type),
                plan_id: opt(&meta.plan_id),
                plan_sponsor_name: opt(&meta.plan_sponsor_name),
                plan_market_type: opt(&meta.plan_market_type),
                version: &meta.version,
                provider_reference_count,
                in_network_count,
                rate_row_count,
            })
            .await
            .map_err(|e| ch_err("write mrf_files row", e))?;
        insert.end().await.map_err(|e| ch_err("end mrf_files insert", e))
    }
}

/// Per-worker writer. Not `Send`-shared: each worker task owns one.
pub struct ClickHouseWriter {
    rates: Inserter<RateRow<'static>>,
    groups: Inserter<ProviderGroupRow<'static>>,
    job_id: Arc<str>,
    zombie_filter: ZombieFilter,
    pub rate_rows: u64,
    pub group_rows: u64,
    /// Rate rows dropped by `zombie_filter` (never written).
    pub zombie_skipped: u64,
}

impl ClickHouseWriter {
    pub async fn provider_reference(&mut self, r: &ProviderReferenceObject) -> Result<(), ClickHouseError> {
        for g in &r.provider_groups {
            self.groups
                .write(&ProviderGroupRow {
                    insurance_scan_job_id: &self.job_id,
                    provider_group_id: r.provider_group_id,
                    network_name: &r.network_name,
                    tin_type: &g.tin.r#type,
                    tin_value: &g.tin.value,
                    business_name: opt(&g.tin.business_name),
                    npi: &g.npi,
                })
                .await
                .map_err(|e| ch_err("write provider_groups row", e))?;
            self.group_rows += 1;
        }
        // `commit` only ends the statement when a threshold is crossed; cheap to call per element.
        self.groups
            .commit()
            .await
            .map_err(|e| ch_err("commit provider_groups", e))?;
        Ok(())
    }

    pub async fn in_network(&mut self, obj: &InNetworkObject) -> Result<(), ClickHouseError> {
        // Provider references are parsed before any in_network element, so the first rate row
        // marks the end of this worker's provider_groups writes. Flush that statement now: it
        // usually has fewer rows than the commit threshold, and if it were left open across the
        // (much longer) rates pass, ClickHouse would time out the idle INSERT and `end()` would
        // fail with "channel closed" — losing every buffered provider_groups row.
        if self.groups.pending().rows > 0 {
            self.groups
                .force_commit()
                .await
                .map_err(|e| ch_err("flush provider_groups before rates", e))?;
        }
        let severity = opt(&obj.severity_of_illness);
        for rate in &obj.negotiated_rate {
            for price in &rate.negotiated_prices {
                // One verdict per price object; it does not depend on the provider group.
                let decision = classify(
                    opt(&price.billing_class),
                    &obj.billing_code,
                    &obj.billing_code_type,
                    &price.billing_code_modifier,
                    price.negotiated_rate,
                );
                if self.zombie_filter.blocks(decision.verdict) {
                    self.zombie_skipped += rate.provider_references.len() as u64;
                    continue;
                }
                let zombie_verdict = verdict_str(decision.verdict);
                let expiration_date = parse_expiration(&price.expiration_date);
                for &provider_group_id in &rate.provider_references {
                    self.rates
                        .write(&RateRow {
                            insurance_scan_job_id: &self.job_id,
                            provider_group_id,
                            negotiation_arrangement: &obj.negotiation_arrangement,
                            billing_code_type: &obj.billing_code_type,
                            billing_code_type_version: &obj.billing_code_type_version,
                            billing_code: &obj.billing_code,
                            name: &obj.name,
                            description: &obj.description,
                            severity_of_illness: severity,
                            negotiated_type: opt(&price.negotiated_type),
                            negotiated_rate: price.negotiated_rate,
                            expiration_date,
                            service_code: &price.service_code,
                            billing_class: opt(&price.billing_class),
                            setting: opt(&price.setting),
                            billing_code_modifier: &price.billing_code_modifier,
                            additional_information: &price.additional_information,
                            zombie_verdict,
                            zombie_rule: decision.rule,
                        })
                        .await
                        .map_err(|e| ch_err("write in_network_rates row", e))?;
                    self.rate_rows += 1;
                }
            }
        }
        self.rates
            .commit()
            .await
            .map_err(|e| ch_err("commit in_network_rates", e))?;
        Ok(())
    }

    /// Ends both inserters, flushing whatever is buffered. Must be awaited or the tail is lost.
    pub async fn finish(self) -> Result<(u64, u64), ClickHouseError> {
        self.rates
            .end()
            .await
            .map_err(|e| ch_err("end in_network_rates inserter", e))?;
        self.groups
            .end()
            .await
            .map_err(|e| ch_err("end provider_groups inserter", e))?;
        Ok((self.rate_rows, self.group_rows))
    }
}
