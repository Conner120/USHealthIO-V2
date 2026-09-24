//! Retry policy for ClickHouse writes.
//!
//! Every insert is retried until it succeeds. The parser runs for hours over multi-GB files, and
//! a restart means redoing all of it, so a ClickHouse restart, a failover or a transient
//! `SOCKET_TIMEOUT` should cost a pause, not the job.
//!
//!   CLICKHOUSE_MAX_RETRIES        0 (default) = retry forever; N = give up after N attempts
//!   CLICKHOUSE_RETRY_ABORT_SECS   0 (default) = never give up on time; N = abort the job after
//!                                 N seconds of retrying ONE batch
//!   CLICKHOUSE_RETRY_BASE_MS      first backoff, doubled each attempt (default 500)
//!   CLICKHOUSE_RETRY_MAX_MS       backoff ceiling (default 60_000)
//!
//! Either limit aborts the job with the last error; with both at 0 the parser waits indefinitely.

use std::time::{Duration, Instant};

#[derive(Debug, Clone)]
pub struct RetryPolicy {
    /// 0 = unlimited.
    pub max_retries: u32,
    /// None = no overall time limit for a single batch.
    pub abort_after: Option<Duration>,
    pub base: Duration,
    pub max: Duration,
}

impl Default for RetryPolicy {
    fn default() -> Self {
        RetryPolicy {
            max_retries: 0,
            abort_after: None,
            base: Duration::from_millis(500),
            max: Duration::from_secs(60),
        }
    }
}

impl RetryPolicy {
    /// Backoff before attempt `n` (1 = first retry): base * 2^(n-1), capped, with ±12.5% jitter
    /// so a hundred workers do not reconnect in lockstep after a server restart.
    pub fn backoff(&self, attempt: u32) -> Duration {
        let shift = attempt.saturating_sub(1).min(20);
        let raw = self.base.saturating_mul(1u32 << shift);
        let capped = raw.min(self.max);
        let millis = capped.as_millis() as u64;
        let jitter = (millis / 8).max(1);
        // Cheap deterministic-ish jitter; no rng dependency.
        let nanos = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.subsec_nanos() as u64)
            .unwrap_or(0);
        Duration::from_millis(millis.saturating_sub(jitter) + (nanos % (jitter * 2 + 1)))
    }

    pub fn describe(&self) -> String {
        let retries = if self.max_retries == 0 {
            "unlimited".to_string()
        } else {
            self.max_retries.to_string()
        };
        match self.abort_after {
            Some(d) => format!("retries={} abort_after={:?} backoff={:?}..{:?}", retries, d, self.base, self.max),
            None => format!("retries={} abort_after=never backoff={:?}..{:?}", retries, self.base, self.max),
        }
    }
}

/// Runs `op` until it succeeds or the policy gives up. `label` names the operation in logs.
pub async fn with_retry<T, E, F, Fut>(label: &str, policy: &RetryPolicy, mut op: F) -> Result<T, E>
where
    F: FnMut() -> Fut,
    Fut: std::future::Future<Output = Result<T, E>>,
    E: std::fmt::Display,
{
    let started = Instant::now();
    let mut attempt: u32 = 0;
    loop {
        match op().await {
            Ok(v) => {
                if attempt > 0 {
                    println!("clickhouse: {} succeeded after {} retr{} ({:.1?})", label, attempt, if attempt == 1 { "y" } else { "ies" }, started.elapsed());
                }
                return Ok(v);
            }
            Err(e) => {
                attempt += 1;
                let out_of_attempts = policy.max_retries > 0 && attempt > policy.max_retries;
                let out_of_time = policy.abort_after.is_some_and(|d| started.elapsed() >= d);
                if out_of_attempts || out_of_time {
                    eprintln!(
                        "clickhouse: {} failed permanently after {} attempt(s) in {:.1?}: {}",
                        label, attempt, started.elapsed(), e
                    );
                    return Err(e);
                }
                let wait = policy.backoff(attempt);
                eprintln!(
                    "clickhouse: {} failed (attempt {}, {:.1?} elapsed): {} — retrying in {:.1?}",
                    label, attempt, started.elapsed(), e, wait
                );
                tokio::time::sleep(wait).await;
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::{AtomicU32, Ordering};

    fn fast() -> RetryPolicy {
        RetryPolicy { max_retries: 0, abort_after: None, base: Duration::from_millis(1), max: Duration::from_millis(2) }
    }

    #[test]
    fn backoff_doubles_and_caps() {
        let p = RetryPolicy { base: Duration::from_millis(1000), max: Duration::from_millis(4000), ..Default::default() };
        // With +-12.5% jitter: attempt 1 ~1000ms, 2 ~2000ms, 3 ~4000ms, then capped.
        assert!(p.backoff(1) >= Duration::from_millis(875) && p.backoff(1) <= Duration::from_millis(1125));
        assert!(p.backoff(2) >= Duration::from_millis(1750) && p.backoff(2) <= Duration::from_millis(2250));
        assert!(p.backoff(9) <= Duration::from_millis(4500));
    }

    #[tokio::test]
    async fn retries_until_success() {
        let calls = AtomicU32::new(0);
        let r: Result<u32, String> = with_retry("test", &fast(), || {
            let n = calls.fetch_add(1, Ordering::SeqCst) + 1;
            async move { if n < 4 { Err(format!("boom {}", n)) } else { Ok(n) } }
        })
        .await;
        assert_eq!(r.unwrap(), 4);
    }

    #[tokio::test]
    async fn gives_up_after_max_retries() {
        let calls = AtomicU32::new(0);
        let policy = RetryPolicy { max_retries: 2, ..fast() };
        let r: Result<(), String> = with_retry("test", &policy, || {
            calls.fetch_add(1, Ordering::SeqCst);
            async { Err("always".to_string()) }
        })
        .await;
        assert!(r.is_err());
        assert_eq!(calls.load(Ordering::SeqCst), 3); // initial + 2 retries
    }

    #[tokio::test]
    async fn gives_up_after_abort_deadline() {
        let policy = RetryPolicy { abort_after: Some(Duration::from_millis(10)), ..fast() };
        let r: Result<(), String> = with_retry("test", &policy, || async { Err("always".to_string()) }).await;
        assert!(r.is_err());
    }
}
