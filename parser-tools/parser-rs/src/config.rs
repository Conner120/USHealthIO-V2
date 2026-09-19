//! Runtime configuration, sourced entirely from environment variables (`.env` is loaded by main).
//!
//! `SINK` selects where parsed rates go:
//!   - `clickhouse` (default) — batched RowBinary inserts straight into ClickHouse
//!   - `rabbitmq`             — the original RabbitMQ stream publisher (`in_network_rates-{SHARD_ID}`)
//!   - `none`                 — parse only, discard output (useful for benchmarking the parser)
//!
//! `ZOMBIE_FILTER` controls what happens to rate rows the structural classifier (`allowlist.rs`)
//! flags. Every row is always tagged with its verdict in ClickHouse; this only decides which are
//! dropped before insert:
//!   - `off` (default) — store everything, tag only
//!   - `deny`          — skip rows with verdict DENY
//!   - `review`        — skip rows with verdict DENY or REVIEW (strict)

use std::env;
use std::time::Duration;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SinkKind {
    ClickHouse,
    RabbitMq,
    None,
}

/// Which classifier verdicts are dropped before the sink. See `allowlist::Verdict`.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ZombieFilter {
    Off,
    Deny,
    Review,
}

impl ZombieFilter {
    fn parse(s: &str) -> ZombieFilter {
        match s.trim().to_ascii_lowercase().as_str() {
            "deny" | "block" | "on" | "true" | "1" => ZombieFilter::Deny,
            "review" | "strict" => ZombieFilter::Review,
            _ => ZombieFilter::Off,
        }
    }

    /// True when a row with this verdict should be skipped.
    pub fn blocks(self, v: crate::allowlist::Verdict) -> bool {
        use crate::allowlist::Verdict;
        match self {
            ZombieFilter::Off => false,
            ZombieFilter::Deny => v == Verdict::Deny,
            ZombieFilter::Review => v != Verdict::Allow,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CompressionKind {
    None,
    Lz4,
    Zstd(i32),
}

impl CompressionKind {
    fn parse(s: &str) -> CompressionKind {
        let s = s.trim().to_ascii_lowercase();
        match s.as_str() {
            "none" | "off" | "false" | "0" => CompressionKind::None,
            "lz4" | "true" | "1" => CompressionKind::Lz4,
            _ if s.starts_with("zstd") => {
                let level = s.split(':').nth(1).and_then(|l| l.parse().ok()).unwrap_or(3);
                CompressionKind::Zstd(level)
            }
            _ => CompressionKind::Lz4,
        }
    }
}

#[derive(Debug, Clone)]
pub struct ClickHouseConfig {
    /// Full HTTP(S) URL, e.g. `http://localhost:8123` or `https://xyz.clickhouse.cloud:8443`.
    pub url: String,
    pub database: String,
    pub user: String,
    pub password: String,
    pub table_rates: String,
    pub table_provider_groups: String,
    pub table_files: String,
    /// Rows buffered per `INSERT` before the client ends the statement and starts a new one.
    pub insert_max_rows: u64,
    /// Uncompressed bytes buffered per `INSERT` before it is ended.
    pub insert_max_bytes: u64,
    /// Optional wall-clock cap per `INSERT`. `None` = size-bounded only.
    pub insert_period: Option<Duration>,
    /// Request body compression: `lz4` (cheap CPU), `zstd` / `zstd:<level>` (fewer bytes on the
    /// wire — pick this when the link to ClickHouse is the bottleneck), or `none`.
    pub compression: CompressionKind,
    /// Fetch the table schema and validate row types on the first insert. Costs one round trip
    /// per table and a little CPU per row; turn on when changing the schema, off for max throughput.
    pub validate_schema: bool,
    /// Timeout for sending a single chunk / for the server to ack the end of an INSERT.
    pub send_timeout: Option<Duration>,
    pub end_timeout: Option<Duration>,
    /// Extra `SETTINGS` applied to every request, from `CLICKHOUSE_SETTINGS="a=1,b=2"`.
    pub extra_settings: Vec<(String, String)>,
}

#[derive(Debug, Clone)]
pub struct RabbitMqConfig {
    pub host: String,
    pub port: u16,
    pub username: String,
    pub password: String,
    pub shard_id: String,
    /// Number of negotiated prices buffered before a batch is published.
    pub batch_prices: usize,
    pub stream_max_length_gb: u64,
}

#[derive(Debug, Clone)]
pub struct Config {
    pub sink: SinkKind,
    /// Drop structurally implausible ("zombie") rate rows before the sink. Rows are always tagged.
    pub zombie_filter: ZombieFilter,
    pub clickhouse: ClickHouseConfig,
    pub rabbitmq: RabbitMqConfig,
    /// Parser worker tasks (element parsing + row writing). Default: all available cores.
    pub threads: usize,
    /// Bounded scanner→worker queue depth (elements). Small: elements are zero-copy mmap slices.
    pub queue_depth: usize,
    /// Retries for `provider_references[].location` fetches.
    pub location_retries: u32,
    /// Abort the job once this many elements failed to parse (0 = never abort, just count).
    pub max_element_errors: u64,
    /// Seconds between progress lines.
    pub progress_secs: u64,
}

fn var_or(key: &str, default: &str) -> String {
    env::var(key).unwrap_or_else(|_| default.to_string())
}

fn parse_or<T: std::str::FromStr>(key: &str, default: T) -> T {
    env::var(key)
        .ok()
        .and_then(|s| s.trim().parse::<T>().ok())
        .unwrap_or(default)
}

fn bool_or(key: &str, default: bool) -> bool {
    match env::var(key) {
        Ok(v) => matches!(
            v.trim().to_ascii_lowercase().as_str(),
            "1" | "true" | "yes" | "on"
        ),
        Err(_) => default,
    }
}

fn secs_opt(key: &str, default_secs: Option<u64>) -> Option<Duration> {
    match env::var(key) {
        Ok(v) => {
            let v = v.trim();
            if v.is_empty() || v == "0" || v.eq_ignore_ascii_case("none") {
                None
            } else {
                v.parse::<u64>().ok().map(Duration::from_secs)
            }
        }
        Err(_) => default_secs.map(Duration::from_secs),
    }
}

impl Config {
    pub fn from_env() -> Config {
        // `SINK` is the primary switch. `PUBSUB_ENABLED=false` is honoured as an alias for
        // "not rabbitmq" so existing deployments can flip the publisher off with one var.
        let sink = match var_or("SINK", "clickhouse").trim().to_ascii_lowercase().as_str() {
            "rabbitmq" | "rabbit" | "pubsub" => {
                if bool_or("PUBSUB_ENABLED", true) {
                    SinkKind::RabbitMq
                } else {
                    SinkKind::ClickHouse
                }
            }
            "none" | "off" | "discard" => SinkKind::None,
            _ => SinkKind::ClickHouse,
        };

        let extra_settings = env::var("CLICKHOUSE_SETTINGS")
            .ok()
            .map(|s| {
                s.split(',')
                    .filter_map(|kv| {
                        let (k, v) = kv.split_once('=')?;
                        let (k, v) = (k.trim(), v.trim());
                        if k.is_empty() {
                            None
                        } else {
                            Some((k.to_string(), v.to_string()))
                        }
                    })
                    .collect()
            })
            .unwrap_or_default();

        Config {
            sink,
            zombie_filter: ZombieFilter::parse(&var_or("ZOMBIE_FILTER", "off")),
            clickhouse: ClickHouseConfig {
                url: var_or("CLICKHOUSE_URL", "http://localhost:8123"),
                database: var_or("CLICKHOUSE_DATABASE", "health"),
                user: var_or("CLICKHOUSE_USER", "default"),
                password: var_or("CLICKHOUSE_PASSWORD", ""),
                table_rates: var_or("CLICKHOUSE_TABLE_RATES", "in_network_rates"),
                table_provider_groups: var_or(
                    "CLICKHOUSE_TABLE_PROVIDER_GROUPS",
                    "provider_groups",
                ),
                table_files: var_or("CLICKHOUSE_TABLE_FILES", "mrf_files"),
                insert_max_rows: parse_or("CLICKHOUSE_INSERT_MAX_ROWS", 500_000),
                insert_max_bytes: parse_or("CLICKHOUSE_INSERT_MAX_BYTES", 256 * 1024 * 1024),
                insert_period: secs_opt("CLICKHOUSE_INSERT_PERIOD_SECS", None),
                compression: CompressionKind::parse(&var_or(
                    "CLICKHOUSE_COMPRESSION",
                    // Legacy switch from the first version of this sink.
                    &var_or("CLICKHOUSE_COMPRESSION_LZ4", "lz4"),
                )),
                validate_schema: bool_or("CLICKHOUSE_VALIDATE_SCHEMA", false),
                send_timeout: secs_opt("CLICKHOUSE_SEND_TIMEOUT_SECS", Some(60)),
                end_timeout: secs_opt("CLICKHOUSE_END_TIMEOUT_SECS", Some(600)),
                extra_settings,
            },
            rabbitmq: RabbitMqConfig {
                host: var_or("RABBITMQ_HOST", "localhost"),
                port: parse_or("RABBITMQ_PORT", 5552),
                username: var_or("RABBITMQ_USER", "guest"),
                password: var_or("RABBITMQ_PASSWORD", "guest"),
                shard_id: var_or("SHARD_ID", "0"),
                batch_prices: parse_or("RABBITMQ_BATCH_PRICES", 50_000),
                stream_max_length_gb: parse_or("RABBITMQ_STREAM_MAX_GB", 10),
            },
            threads: parse_or(
                "PARSER_THREADS",
                std::thread::available_parallelism().map(|n| n.get()).unwrap_or(4),
            )
            .max(1),
            queue_depth: parse_or("PARSER_QUEUE_DEPTH", 1024).max(1),
            location_retries: parse_or("PARSER_LOCATION_RETRIES", 3),
            max_element_errors: parse_or("PARSER_MAX_ELEMENT_ERRORS", 1000),
            progress_secs: parse_or("PARSER_PROGRESS_SECS", 5).max(1),
        }
    }
}
