//! Output sinks for parsed in-network rates. Which one is used is decided by `SINK` (see config.rs)
//! and wired up in `pipeline.rs`.

pub mod clickhouse;
pub mod retry;
pub mod rabbitmq;

/// Counters reported back by a sink when it finishes.
#[derive(Debug, Default, Clone, Copy)]
pub struct SinkStats {
    /// Rows (ClickHouse) or messages (RabbitMQ) emitted.
    pub emitted: u64,
}
