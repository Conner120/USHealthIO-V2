//! ClickHouse sink for the v2 content-addressed schema (`clickhouse-schema/schema.sql`), using
//! the official `clickhouse` crate (HTTP + RowBinary + LZ4).
//!
//! What gets written for one file / job:
//!   * `provider_groups`        one row per distinct TIN in the file (entity; AggregatingMergeTree
//!                              keeps first/last ingested across jobs)
//!   * `provider_group_seen`    one row per (file-local provider_group_id, TIN): NPIs + networks as
//!                              listed in this file
//!   * `rates`                  one row per distinct rate_hash in the file (entity)
//!   * `rate_seen`              one row per (rate_hash, TIN) per negotiated price — THE fact table
//!   * `mrf_files`              one header row with counts
//!
//! Two passes over the file: pass 1 collects `provider_references` (the pipeline forwards them to
//! `provider_references()`, which writes the two provider tables and builds the local id -> TIN
//! hash map); pass 2 streams `in_network` through per-worker `ClickHouseWriter`s, which resolve
//! each `provider_references[]` id to TIN hashes through that map.
//!
//! Ingest strategy, tuned for bulk load and for surviving a flaky server:
//!   * Every worker owns its own batches, so N workers means N concurrent INSERTs.
//!   * Rows are buffered (owned) until `CLICKHOUSE_INSERT_MAX_ROWS`, then sent as ONE statement
//!     that is opened, written and ended immediately. Nothing is ever held open waiting for more
//!     rows — that was the cause of `Code: 209 SOCKET_TIMEOUT`, because a worker can go minutes
//!     without a new `rates` row (only the first sighting of each hash is written) while the
//!     server's socket read timeout is 30s.
//!   * Because the batch is still in memory when the statement is sent, a failed insert is
//!     retried with backoff instead of losing rows — unlimited by default, see `retry.rs`.
//!     Each statement carries `CLICKHOUSE_SEND_TIMEOUT_SECS` / `_END_TIMEOUT_SECS`, so a hung
//!     connection fails (and is retried) instead of parking a worker forever.
//!   * `rates` rows are written once per hash per job (a shared `DashSet`); `rate_seen` rows are
//!     deduplicated per in_network element, which covers local ids that share a TIN.

use crate::allowlist::{classify, Verdict};
use crate::config::{ClickHouseConfig, CompressionKind, ZombieFilter};
use crate::hashing::{provider_group_hash, sorted, sorted_i64, RateKey};
use crate::model::{FileHeader, InNetworkObject, ProviderReferenceObject};
use crate::sink::retry::with_retry;
use chrono::{DateTime, NaiveDate, Utc};
use clickhouse::{Client, Compression, Row, RowOwned, RowWrite};
use dashmap::{DashMap, DashSet};
use serde::Serialize;
use std::collections::HashSet;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;

/// Date32 upper bound (ClickHouse cannot represent the `9999-12-31` "never expires" sentinel
/// that many carriers use). Anything past it is clamped here so it still sorts as "far future".
const DATE32_MAX: NaiveDate = match NaiveDate::from_ymd_opt(2299, 12, 31) {
    Some(d) => d,
    None => unreachable!(),
};

// ------------------------------------------------------------------------------------ rows

/// `rates`: one distinct negotiated price. Arrays are stored sorted (same as hashed).
#[derive(Row, Serialize)]
struct RateRow {
    rate_hash: u64,
    billing_key_hash: u64,
    billing_code_type: String,
    billing_code_type_version: String,
    billing_code: String,
    negotiation_arrangement: String,
    negotiated_type: String,
    negotiated_rate: Option<f64>,
    billing_class: String,
    setting: String,
    severity_of_illness: String,
    service_code: Vec<String>,
    billing_code_modifier: Vec<String>,
    additional_information: Vec<String>,
    name: String,
    description: String,
    zombie_verdict: String,
    zombie_rule: String,
    #[serde(with = "clickhouse::serde::chrono::datetime")]
    first_ingested_at: DateTime<Utc>,
    #[serde(with = "clickhouse::serde::chrono::datetime")]
    last_ingested_at: DateTime<Utc>,
}

/// `rate_seen`: rate R offered to TIN P in this job.
#[derive(Row, Serialize)]
struct RateSeenRow {
    rate_hash: u64,
    billing_key_hash: u64,
    provider_group_hash: u64,
    insurance_scan_job_id: String,
    #[serde(with = "clickhouse::serde::chrono::date")]
    seen_on: NaiveDate,
    #[serde(with = "clickhouse::serde::chrono::date32::option")]
    expiration_date: Option<NaiveDate>,
}

/// `provider_groups`: one distinct TIN.
#[derive(Row, Serialize)]
struct ProviderGroupRow {
    provider_group_hash: u64,
    tin_type: String,
    tin_value: String,
    business_name: String,
    #[serde(with = "clickhouse::serde::chrono::datetime")]
    first_ingested_at: DateTime<Utc>,
    #[serde(with = "clickhouse::serde::chrono::datetime")]
    last_ingested_at: DateTime<Utc>,
}

/// `provider_group_seen`: TIN P appeared in this file under local id G with these NPIs.
#[derive(Row, Serialize)]
struct ProviderGroupSeenRow {
    provider_group_hash: u64,
    insurance_scan_job_id: String,
    provider_group_id: i64,
    npi: Vec<i64>,
    network_name: Vec<String>,
    #[serde(with = "clickhouse::serde::chrono::date")]
    seen_on: NaiveDate,
}

#[derive(Row, Serialize)]
struct FileRow<'a> {
    insurance_scan_job_id: &'a str,
    file_url: &'a str,
    reporting_entity_name: &'a str,
    reporting_entity_type: &'a str,
    #[serde(with = "clickhouse::serde::chrono::date")]
    last_updated_on: NaiveDate,
    version: &'a str,
    provider_reference_count: u64,
    in_network_count: u64,
    rate_row_count: u64,
    distinct_rate_count: u64,
}

/// Rough heap footprint of a buffered row, so a batch can be bounded by bytes as well as rows.
/// Only the owned allocations matter; the struct itself is counted by `Vec`'s capacity.
trait HeapSize {
    fn heap_size(&self) -> usize;
}

fn strs(v: &[String]) -> usize {
    v.iter().map(|s| s.len() + 24).sum::<usize>()
}

impl HeapSize for RateRow {
    fn heap_size(&self) -> usize {
        self.billing_code_type.len()
            + self.billing_code_type_version.len()
            + self.billing_code.len()
            + self.negotiation_arrangement.len()
            + self.negotiated_type.len()
            + self.billing_class.len()
            + self.setting.len()
            + self.severity_of_illness.len()
            + self.name.len()
            + self.description.len()
            + self.zombie_verdict.len()
            + self.zombie_rule.len()
            + strs(&self.service_code)
            + strs(&self.billing_code_modifier)
            + strs(&self.additional_information)
            + std::mem::size_of::<Self>()
    }
}

impl HeapSize for RateSeenRow {
    fn heap_size(&self) -> usize {
        self.insurance_scan_job_id.len() + std::mem::size_of::<Self>()
    }
}

impl HeapSize for ProviderGroupRow {
    fn heap_size(&self) -> usize {
        self.tin_type.len() + self.tin_value.len() + self.business_name.len() + std::mem::size_of::<Self>()
    }
}

impl HeapSize for ProviderGroupSeenRow {
    fn heap_size(&self) -> usize {
        self.insurance_scan_job_id.len()
            + self.npi.len() * 8
            + strs(&self.network_name)
            + std::mem::size_of::<Self>()
    }
}

// ------------------------------------------------------------------------------------ batch

/// A buffer of owned rows for one table. `push` collects; when the buffer reaches `max_rows` the
/// caller flushes it, which opens an INSERT, writes every row and ends it in one go. The rows stay
/// in memory until the server acks, so a failure is retried rather than lost.
struct Batch<T> {
    table: String,
    rows: Vec<T>,
    max_rows: usize,
    /// Flush once the buffered rows are estimated to exceed this many bytes. This is what
    /// actually bounds per-worker memory: `rates` rows carry a dozen strings each, so a row
    /// count alone is a poor proxy for how much a full batch costs.
    max_bytes: usize,
    approx_bytes: usize,
    /// Rows successfully written to ClickHouse from this batch.
    written: u64,
}

impl<T: RowOwned + RowWrite + HeapSize> Batch<T> {
    fn new(table: &str, max_rows: u64, max_bytes: u64) -> Self {
        let max_rows = max_rows.max(1) as usize;
        Batch {
            table: table.to_string(),
            // Don't pre-reserve the whole row budget: a batch that is bounded by bytes will
            // usually flush long before it gets there.
            rows: Vec::with_capacity(max_rows.min(8 * 1024)),
            max_rows,
            max_bytes: max_bytes.max(1) as usize,
            approx_bytes: 0,
            written: 0,
        }
    }

    fn push(&mut self, row: T) {
        self.approx_bytes += row.heap_size();
        self.rows.push(row);
    }

    fn is_full(&self) -> bool {
        self.rows.len() >= self.max_rows || self.approx_bytes >= self.max_bytes
    }

    /// Sends the buffer as one INSERT, retrying the whole statement on failure. A retry re-sends
    /// every row: ClickHouse never saw a successful end() for the failed attempt, so the rows did
    /// not land (an attempt that timed out *after* the server committed would duplicate, which the
    /// ReplacingMergeTree / AggregatingMergeTree keys collapse on merge).
    async fn flush(&mut self, client: &Client, cfg: &ClickHouseConfig, statements: &AtomicU64) -> Result<(), ClickHouseError> {
        if self.rows.is_empty() {
            return Ok(());
        }
        let label = format!("insert {} ({} rows)", self.table, self.rows.len());
        let rows = &self.rows;
        let table = &self.table;
        with_retry(&label, &cfg.retry, || async move {
            let mut insert = client
                .insert::<T>(table.as_str())
                .await
                .map_err(|e| ch_err(&format!("begin {} insert", table), e))?
                .with_timeouts(cfg.send_timeout, cfg.end_timeout);
            for row in rows.iter() {
                insert
                    .write(row)
                    .await
                    .map_err(|e| ch_err(&format!("write {} row", table), e))?;
            }
            insert
                .end()
                .await
                .map_err(|e| ch_err(&format!("end {} insert", table), e))
        })
        .await?;
        statements.fetch_add(1, Ordering::Relaxed);
        self.written += self.rows.len() as u64;
        self.rows.clear();
        self.approx_bytes = 0;
        Ok(())
    }

    /// Flush if the buffer is full; cheap to call per element.
    async fn maybe_flush(&mut self, client: &Client, cfg: &ClickHouseConfig, statements: &AtomicU64) -> Result<(), ClickHouseError> {
        if self.is_full() {
            self.flush(client, cfg, statements).await?;
        }
        Ok(())
    }
}

// --------------------------------------------------------------------------------- helpers

#[derive(Debug)]
pub struct ClickHouseError(pub String);

impl std::fmt::Display for ClickHouseError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(&self.0)
    }
}

impl std::error::Error for ClickHouseError {}

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

fn parse_date(s: &Option<String>) -> Option<NaiveDate> {
    let s = s.as_deref()?.trim();
    // MRF dates are `YYYY-MM-DD`; tolerate a trailing time component just in case.
    let date_part = s.get(..10).unwrap_or(s);
    NaiveDate::parse_from_str(date_part, "%Y-%m-%d").ok()
}

fn parse_expiration(s: &Option<String>) -> Option<NaiveDate> {
    parse_date(s).map(|d| d.min(DATE32_MAX))
}

/// `seen_on` for every seen row of this job: the file's own `last_updated_on`, or today when the
/// header lacks it (older files) so the row still lands in a sensible partition.
pub fn seen_on_for(header: &FileHeader) -> NaiveDate {
    parse_date(&header.last_updated_on).unwrap_or_else(|| Utc::now().date_naive())
}

// ------------------------------------------------------------------------------------ sink

/// Shared connection + per-job state; cheap to clone into every worker.
#[derive(Clone)]
pub struct ClickHouseSink {
    client: Client,
    cfg: Arc<ClickHouseConfig>,
    job_id: Arc<str>,
    /// Completed INSERT statements across all writers.
    statements: Arc<AtomicU64>,
    /// file-local provider_group_id -> TIN hashes it expands to. Built in pass 1, read in pass 2.
    groups_by_local_id: Arc<DashMap<i64, Arc<[u64]>>>,
    /// rate_hash values already written to `rates` in this job.
    rates_written: Arc<DashSet<u64>>,
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
            groups_by_local_id: Arc::new(DashMap::new()),
            rates_written: Arc::new(DashSet::new()),
        })
    }

    pub fn statements(&self) -> u64 {
        self.statements.load(Ordering::Relaxed)
    }

    pub fn distinct_rates(&self) -> u64 {
        self.rates_written.len() as u64
    }

    /// Pass 1 writer. Provider references are written as they are parsed — nothing accumulates a
    /// copy of the section, which on a large file is gigabytes of owned NPI vectors and strings.
    pub fn provider_group_writer(&self, seen_on: NaiveDate) -> ProviderGroupWriter {
        ProviderGroupWriter {
            client: self.client.clone(),
            cfg: self.cfg.clone(),
            statements: self.statements.clone(),
            groups: Batch::new(&self.cfg.table_provider_groups, self.cfg.insert_max_rows, self.cfg.insert_max_bytes),
            seen: Batch::new(&self.cfg.table_provider_group_seen, self.cfg.insert_max_rows, self.cfg.insert_max_bytes),
            job_id: self.job_id.clone(),
            groups_by_local_id: self.groups_by_local_id.clone(),
            tins_written: HashSet::new(),
            seen_on,
            group_rows: 0,
            seen_rows: 0,
        }
    }

    /// Pass 2 writer for one worker. `seen_on` is the file's publication date (see `seen_on_for`).
    pub fn writer(&self, zombie_filter: ZombieFilter, seen_on: NaiveDate) -> ClickHouseWriter {
        ClickHouseWriter {
            client: self.client.clone(),
            cfg: self.cfg.clone(),
            statements: self.statements.clone(),
            rates: Batch::new(&self.cfg.table_rates, self.cfg.insert_max_rows, self.cfg.insert_max_bytes),
            seen: Batch::new(&self.cfg.table_rate_seen, self.cfg.insert_max_rows, self.cfg.insert_max_bytes),
            job_id: self.job_id.clone(),
            groups_by_local_id: self.groups_by_local_id.clone(),
            rates_written: self.rates_written.clone(),
            zombie_filter,
            seen_on,
            rate_rows: 0,
            seen_rows: 0,
            zombie_skipped: 0,
            unresolved_refs: 0,
        }
    }

    pub async fn file_meta(
        &self,
        meta: &FileHeader,
        provider_reference_count: u64,
        in_network_count: u64,
        rate_row_count: u64,
    ) -> Result<(), ClickHouseError> {
        let row = FileRow {
                insurance_scan_job_id: &self.job_id,
                file_url: &self.cfg.file_url,
                reporting_entity_name: &meta.reporting_entity_name,
                reporting_entity_type: &meta.reporting_entity_type,
                last_updated_on: seen_on_for(meta),
                version: &meta.version,
                provider_reference_count,
                in_network_count,
                rate_row_count,
            distinct_rate_count: self.distinct_rates(),
        };
        with_retry("insert mrf_files", &self.cfg.retry, || async {
            let mut insert = self
                .client
                .insert::<FileRow>(self.cfg.table_files.as_str())
                .await
                .map_err(|e| ch_err("begin mrf_files insert", e))?
                .with_timeouts(self.cfg.send_timeout, self.cfg.end_timeout);
            insert.write(&row).await.map_err(|e| ch_err("write mrf_files row", e))?;
            insert.end().await.map_err(|e| ch_err("end mrf_files insert", e))
        })
        .await
    }
}

// ------------------------------------------------------------------------ pass 1 writer

/// Writes `provider_groups` + `provider_group_seen` as references stream past, and builds the
/// file-local id -> TIN hash map pass 2 resolves rates through. Owned by one task.
pub struct ProviderGroupWriter {
    client: Client,
    cfg: Arc<ClickHouseConfig>,
    statements: Arc<AtomicU64>,
    groups: Batch<ProviderGroupRow>,
    seen: Batch<ProviderGroupSeenRow>,
    job_id: Arc<str>,
    groups_by_local_id: Arc<DashMap<i64, Arc<[u64]>>>,
    /// TINs already written to `provider_groups` this job (8 bytes each, one per distinct TIN).
    tins_written: HashSet<u64>,
    seen_on: NaiveDate,
    pub group_rows: u64,
    pub seen_rows: u64,
}

impl ProviderGroupWriter {
    pub async fn write(&mut self, r: &ProviderReferenceObject) -> Result<(), ClickHouseError> {
        let now = Utc::now();
        let mut hashes: Vec<u64> = Vec::with_capacity(r.provider_groups.len());
        for g in &r.provider_groups {
            let hash = provider_group_hash(&g.tin.r#type, &g.tin.value);
            hashes.push(hash);
            if self.tins_written.insert(hash) {
                self.groups.push(ProviderGroupRow {
                    provider_group_hash: hash,
                    tin_type: g.tin.r#type.clone(),
                    tin_value: g.tin.value.clone(),
                    business_name: opt(&g.tin.business_name).to_string(),
                    first_ingested_at: now,
                    last_ingested_at: now,
                });
                self.group_rows += 1;
            }
            self.seen.push(ProviderGroupSeenRow {
                provider_group_hash: hash,
                insurance_scan_job_id: self.job_id.to_string(),
                provider_group_id: r.provider_group_id,
                npi: sorted_i64(&g.npi).into_owned(),
                network_name: r.network_name.clone(),
                seen_on: self.seen_on,
            });
            self.seen_rows += 1;
        }
        hashes.sort_unstable();
        hashes.dedup();
        self.groups_by_local_id.insert(r.provider_group_id, Arc::from(hashes));
        self.groups.maybe_flush(&self.client, &self.cfg, &self.statements).await?;
        self.seen.maybe_flush(&self.client, &self.cfg, &self.statements).await?;
        Ok(())
    }

    /// Returns (provider_groups rows, provider_group_seen rows).
    pub async fn finish(mut self) -> Result<(u64, u64), ClickHouseError> {
        self.groups.flush(&self.client, &self.cfg, &self.statements).await?;
        self.seen.flush(&self.client, &self.cfg, &self.statements).await?;
        Ok((self.group_rows, self.seen_rows))
    }
}

// ---------------------------------------------------------------------------------- writer

/// Per-worker pass-2 writer. Not `Send`-shared: each worker task owns one.
pub struct ClickHouseWriter {
    client: Client,
    cfg: Arc<ClickHouseConfig>,
    statements: Arc<AtomicU64>,
    rates: Batch<RateRow>,
    seen: Batch<RateSeenRow>,
    job_id: Arc<str>,
    groups_by_local_id: Arc<DashMap<i64, Arc<[u64]>>>,
    rates_written: Arc<DashSet<u64>>,
    zombie_filter: ZombieFilter,
    seen_on: NaiveDate,
    /// `rates` rows written by this worker (first sighting of a hash in this job).
    pub rate_rows: u64,
    /// `rate_seen` rows written by this worker.
    pub seen_rows: u64,
    /// (price × provider reference) pairs dropped by `zombie_filter` (never written).
    pub zombie_skipped: u64,
    /// `provider_references[]` ids with no entry from pass 1 (file inconsistency).
    pub unresolved_refs: u64,
}

impl ClickHouseWriter {
    pub async fn in_network(&mut self, obj: &InNetworkObject) -> Result<(), ClickHouseError> {
        let now = Utc::now();
        let severity = opt(&obj.severity_of_illness);
        // (rate_hash, TIN hash) pairs already written for this element: several local
        // provider_reference ids commonly resolve to the same TIN.
        let mut seen_pairs: HashSet<(u64, u64)> = HashSet::new();

        for rate in &obj.negotiated_rate {
            // Resolve local ids -> TIN hashes once per negotiated_rate object.
            let mut tins: Vec<u64> = Vec::new();
            for id in &rate.provider_references {
                match self.groups_by_local_id.get(id) {
                    Some(h) => tins.extend_from_slice(&h),
                    None => self.unresolved_refs += 1,
                }
            }
            tins.sort_unstable();
            tins.dedup();
            if tins.is_empty() {
                continue;
            }

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
                    self.zombie_skipped += tins.len() as u64;
                    continue;
                }

                let service_code = sorted(&price.service_code);
                let modifiers = sorted(&price.billing_code_modifier);
                let additional = sorted(&price.additional_information);
                let key = RateKey {
                    billing_code_type: &obj.billing_code_type,
                    billing_code_type_version: &obj.billing_code_type_version,
                    billing_code: &obj.billing_code,
                    negotiation_arrangement: &obj.negotiation_arrangement,
                    negotiated_type: opt(&price.negotiated_type),
                    negotiated_rate: price.negotiated_rate,
                    billing_class: opt(&price.billing_class),
                    setting: opt(&price.setting),
                    severity_of_illness: severity,
                    service_code: &service_code,
                    billing_code_modifier: &modifiers,
                    additional_information: &additional,
                };
                let rate_hash = key.rate_hash();
                let billing_key_hash = key.billing_key_hash();

                // Writing a `rates` row twice is harmless — the table is an AggregatingMergeTree
                // keyed by rate_hash, so duplicates collapse on merge. Past the cap we stop
                // tracking hashes and let the server dedup, which bounds this set's memory.
                let dedup_cap = self.cfg.rate_dedup_max;
                let track = dedup_cap == 0 || self.rates_written.len() < dedup_cap;
                if (track && self.rates_written.insert(rate_hash)) || !track {
                    self.rates.push(RateRow {
                        rate_hash,
                        billing_key_hash,
                        billing_code_type: key.billing_code_type.to_string(),
                        billing_code_type_version: key.billing_code_type_version.to_string(),
                        billing_code: key.billing_code.to_string(),
                        negotiation_arrangement: key.negotiation_arrangement.to_string(),
                        negotiated_type: key.negotiated_type.to_string(),
                        negotiated_rate: key.negotiated_rate,
                        billing_class: key.billing_class.to_string(),
                        setting: key.setting.to_string(),
                        severity_of_illness: key.severity_of_illness.to_string(),
                        service_code: key.service_code.to_vec(),
                        billing_code_modifier: key.billing_code_modifier.to_vec(),
                        additional_information: key.additional_information.to_vec(),
                        name: obj.name.clone(),
                        description: obj.description.clone(),
                        zombie_verdict: verdict_str(decision.verdict).to_string(),
                        zombie_rule: decision.rule.to_string(),
                        first_ingested_at: now,
                        last_ingested_at: now,
                    });
                    self.rate_rows += 1;
                }

                let expiration_date = parse_expiration(&price.expiration_date);
                for &provider_group_hash in &tins {
                    if !seen_pairs.insert((rate_hash, provider_group_hash)) {
                        continue;
                    }
                    self.seen.push(RateSeenRow {
                        rate_hash,
                        billing_key_hash,
                        provider_group_hash,
                        insurance_scan_job_id: self.job_id.to_string(),
                        seen_on: self.seen_on,
                        expiration_date,
                    });
                    self.seen_rows += 1;
                }
            }
        }
        // Sends only when a batch is full; the statement is opened and ended in one go, so
        // nothing is left open between elements.
        self.rates.maybe_flush(&self.client, &self.cfg, &self.statements).await?;
        self.seen.maybe_flush(&self.client, &self.cfg, &self.statements).await?;
        Ok(())
    }

    /// Sends whatever is still buffered. Must be awaited or the tail is lost.
    /// Returns (rates rows, rate_seen rows).
    pub async fn finish(mut self) -> Result<(u64, u64), ClickHouseError> {
        self.rates.flush(&self.client, &self.cfg, &self.statements).await?;
        self.seen.flush(&self.client, &self.cfg, &self.statements).await?;
        Ok((self.rate_rows, self.seen_rows))
    }
}
