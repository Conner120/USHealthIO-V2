//! Parallel parse pipeline.
//!
//! ```text
//!   mmap(file) ──► scanner thread ──► bounded queue of (section, byte range)
//!                                          │
//!                    ┌─────────────────────┼─────────────────────┐
//!                    ▼                     ▼                     ▼
//!               worker 0              worker 1     ...      worker N-1
//!          serde_json::from_slice  (one element each, zero-copy from the mmap)
//!                    │                     │                     │
//!            ClickHouse:  each worker owns its own Inserters → N concurrent INSERT streams
//!            RabbitMQ:    workers forward parsed objects to one publisher task (ordering kept)
//!            none:        count only
//! ```
//!
//! For ClickHouse the `provider_references` and `in_network` sections are independent tables, so a
//! single scan pass interleaves both and workers never wait. RabbitMQ needs every provider group
//! resolved before the first rate message, so it runs two passes (the second pass re-scans at
//! >1 GB/s without decoding, which is negligible next to the parse itself).

use crate::config::{Config, SinkKind};
use crate::fetch::{http_client, resolve_location};
use crate::model::{FileHeader, InNetworkObject, ProviderReferenceObject};
use crate::scan::{scan, Element, ScanError, ScanStats, Section};
use crate::sink::clickhouse::{ClickHouseSink, ClickHouseWriter};
use crate::sink::rabbitmq::RabbitMqSink;
use memmap2::{Advice, Mmap};
use std::fs::File;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::sync::mpsc;
use tokio::task::JoinHandle;

#[derive(Debug)]
pub struct PipelineError {
    pub message: String,
}

fn perr(msg: impl Into<String>) -> PipelineError {
    PipelineError { message: msg.into() }
}

impl From<ScanError> for PipelineError {
    fn from(e: ScanError) -> Self {
        perr(format!("scan: {}", e.message))
    }
}
impl From<crate::sink::clickhouse::ClickHouseError> for PipelineError {
    fn from(e: crate::sink::clickhouse::ClickHouseError) -> Self {
        perr(e.0)
    }
}
impl From<crate::sink::rabbitmq::RabbitMqError> for PipelineError {
    fn from(e: crate::sink::rabbitmq::RabbitMqError) -> Self {
        perr(e.message)
    }
}

/// Live counters shared by all workers; read by the progress ticker.
#[derive(Default)]
struct Progress {
    bytes: AtomicU64,
    provider_refs: AtomicU64,
    in_network: AtomicU64,
    prices: AtomicU64,
    rate_rows: AtomicU64,
    group_rows: AtomicU64,
    /// Rate rows dropped by `ZOMBIE_FILTER` (ClickHouse sink only).
    zombie_skipped: AtomicU64,
    errors: AtomicU64,
}

impl Progress {
    fn add(&self, c: &AtomicU64, n: u64) {
        c.fetch_add(n, Ordering::Relaxed);
    }
    fn get(&self, c: &AtomicU64) -> u64 {
        c.load(Ordering::Relaxed)
    }
}

/// What a worker does with a parsed element.
enum WorkerSink {
    ClickHouse(ClickHouseWriter),
    Forward(mpsc::Sender<Parsed>),
    Discard,
}

enum Parsed {
    ProviderReference(ProviderReferenceObject),
    InNetwork(InNetworkObject),
}

struct Shared {
    buf: Mmap,
    cfg: Config,
    progress: Progress,
    total_bytes: u64,
}

pub async fn run(cfg: &Config, path: &str, job_id: &str) -> Result<(), PipelineError> {
    let file = File::open(path).map_err(|e| perr(format!("open {}: {}", path, e)))?;
    // SAFETY: the file is treated as read-only input; concurrent modification would be a caller bug.
    let buf = unsafe { Mmap::map(&file) }.map_err(|e| perr(format!("mmap {}: {}", path, e)))?;
    let _ = buf.advise(Advice::Sequential);
    let total_bytes = buf.len() as u64;
    println!(
        "parser: {} ({:.2} GB), {} workers, queue depth {}, sink {:?}",
        path,
        total_bytes as f64 / 1e9,
        cfg.threads,
        cfg.queue_depth,
        cfg.sink
    );
    let shared = Arc::new(Shared {
        buf,
        cfg: cfg.clone(),
        progress: Progress::default(),
        total_bytes,
    });
    let started = Instant::now();
    // Diagnostic: measure the structural scan alone (no parsing, no sink).
    if std::env::var("PARSER_SCAN_ONLY").is_ok() {
        for pass in 1..=2 {
            let t = Instant::now();
            let (_, stats) = scan(&shared.buf, &[Section::ProviderReferences, Section::InNetwork], |_| Ok(()))?;
            println!(
                "scan only pass {}: {:?} in {:.2?} ({:.0} MB/s)",
                pass,
                stats,
                t.elapsed(),
                total_bytes as f64 / t.elapsed().as_secs_f64() / 1e6
            );
        }
        return Ok(());
    }
    let ticker = spawn_progress_ticker(shared.clone(), started);

    let result = match cfg.sink {
        SinkKind::ClickHouse => run_clickhouse(shared.clone(), job_id).await,
        SinkKind::RabbitMq => run_rabbitmq(shared.clone(), job_id).await,
        SinkKind::None => run_discard(shared.clone()).await,
    };
    ticker.abort();
    let p = &shared.progress;
    println!(
        "parser: done in {:.2?} — {} provider_references, {} in_network objects, {} prices, {} rate rows, {} provider_group rows, {} zombie rows skipped ({:?}), {} element errors",
        started.elapsed(),
        p.get(&p.provider_refs),
        p.get(&p.in_network),
        p.get(&p.prices),
        p.get(&p.rate_rows),
        p.get(&p.group_rows),
        p.get(&p.zombie_skipped),
        shared.cfg.zombie_filter,
        p.get(&p.errors),
    );
    result
}

// ------------------------------------------------------------------------------------ drivers

async fn run_clickhouse(shared: Arc<Shared>, job_id: &str) -> Result<(), PipelineError> {
    let sink = ClickHouseSink::connect(&shared.cfg.clickhouse, job_id).await?;
    println!(
        "sink: clickhouse {} db={} ({} rows / {} MiB per INSERT per worker)",
        shared.cfg.clickhouse.url,
        shared.cfg.clickhouse.database,
        shared.cfg.clickhouse.insert_max_rows,
        shared.cfg.clickhouse.insert_max_bytes / 1048576
    );
    let (header, stats) = run_pass(
        shared.clone(),
        &[Section::ProviderReferences, Section::InNetwork],
        || WorkerSink::ClickHouse(sink.writer(shared.cfg.zombie_filter)),
    )
    .await?;
    let p = &shared.progress;
    sink.file_meta(
        &header,
        stats.provider_reference_elements,
        stats.in_network_elements,
        p.get(&p.rate_rows),
    )
    .await?;
    println!("clickhouse: {} INSERT statements completed", sink.statements());
    Ok(())
}

async fn run_rabbitmq(shared: Arc<Shared>, job_id: &str) -> Result<(), PipelineError> {
    let mut sink = RabbitMqSink::new(&shared.cfg.rabbitmq, job_id).await?;
    println!(
        "sink: rabbitmq {}:{} shard={}",
        shared.cfg.rabbitmq.host, shared.cfg.rabbitmq.port, shared.cfg.rabbitmq.shard_id
    );

    // Pass 1: provider references → single map inside the sink.
    let (tx, mut rx) = mpsc::channel::<Parsed>(shared.cfg.queue_depth);
    let collector: JoinHandle<Vec<ProviderReferenceObject>> = tokio::spawn(async move {
        let mut refs = Vec::new();
        while let Some(p) = rx.recv().await {
            if let Parsed::ProviderReference(r) = p {
                refs.push(r);
            }
        }
        refs
    });
    run_pass(shared.clone(), &[Section::ProviderReferences], || {
        WorkerSink::Forward(tx.clone())
    })
    .await?;
    drop(tx);
    let refs = collector.await.map_err(|e| perr(format!("collector: {}", e)))?;
    sink.provider_references(&refs)?;
    drop(refs);

    // Pass 2: rates, published in the order workers finish them (message order was never
    // guaranteed by the old parser either — the consumer keys on message contents).
    let (tx, mut rx) = mpsc::channel::<Parsed>(shared.cfg.queue_depth);
    let publisher: JoinHandle<Result<RabbitMqSink, PipelineError>> = tokio::spawn(async move {
        while let Some(p) = rx.recv().await {
            if let Parsed::InNetwork(obj) = p {
                sink.in_network(obj).await?;
            }
        }
        sink.flush().await?;
        Ok(sink)
    });
    run_pass(shared.clone(), &[Section::InNetwork], || WorkerSink::Forward(tx.clone())).await?;
    drop(tx);
    let sink = publisher.await.map_err(|e| perr(format!("publisher: {}", e)))??;
    let stats = sink.finish().await?;
    println!("rabbitmq: {} messages published", stats.emitted);
    Ok(())
}

async fn run_discard(shared: Arc<Shared>) -> Result<(), PipelineError> {
    println!("sink: none (output discarded)");
    run_pass(
        shared,
        &[Section::ProviderReferences, Section::InNetwork],
        || WorkerSink::Discard,
    )
    .await?;
    Ok(())
}

// --------------------------------------------------------------------------------- one pass

/// Scans the selected sections once and fans elements out to `cfg.threads` workers.
async fn run_pass(
    shared: Arc<Shared>,
    sections: &'static [Section],
    mut make_sink: impl FnMut() -> WorkerSink,
) -> Result<(FileHeader, ScanStats), PipelineError> {
    let (tx, rx) = flume::bounded::<Element>(shared.cfg.queue_depth);

    let mut workers = Vec::with_capacity(shared.cfg.threads);
    for id in 0..shared.cfg.threads {
        let rx = rx.clone();
        let shared = shared.clone();
        let sink = make_sink();
        workers.push(tokio::spawn(worker(id, shared, rx, sink)));
    }
    drop(rx);

    let scanner = {
        let shared = shared.clone();
        tokio::task::spawn_blocking(move || {
            scan(&shared.buf, sections, |el| {
                tx.send(el).map_err(|_| ScanError {
                    message: "all workers stopped".to_string(),
                })
            })
        })
    };

    let scan_result = scanner
        .await
        .map_err(|e| perr(format!("scanner panicked: {}", e)))?;

    // Always drain the workers so their errors surface even if the scanner failed first.
    let mut first_err: Option<PipelineError> = None;
    for w in workers {
        match w.await {
            Ok(Ok(())) => {}
            Ok(Err(e)) => {
                first_err.get_or_insert(e);
            }
            Err(e) => {
                first_err.get_or_insert(perr(format!("worker panicked: {}", e)));
            }
        }
    }
    if let Some(e) = first_err {
        return Err(e);
    }
    Ok(scan_result?)
}

async fn worker(
    id: usize,
    shared: Arc<Shared>,
    rx: flume::Receiver<Element>,
    mut sink: WorkerSink,
) -> Result<(), PipelineError> {
    let http = http_client();
    let p = &shared.progress;
    let cfg = &shared.cfg;

    while let Ok(el) = rx.recv_async().await {
        let slice = &shared.buf[el.start..el.end];
        match el.section {
            Section::ProviderReferences => {
                let parsed = serde_json::from_slice::<ProviderReferenceObject>(slice);
                let mut r = match parsed {
                    Ok(r) => r,
                    Err(e) => {
                        record_error(&shared, &el, slice, &e.to_string())?;
                        continue;
                    }
                };
                if r.location.is_some() {
                    r = match resolve_location(r, &http, cfg.location_retries).await {
                        Ok(r) => r,
                        Err(e) => {
                            record_error(&shared, &el, slice, &e)?;
                            continue;
                        }
                    };
                }
                p.add(&p.provider_refs, 1);
                match &mut sink {
                    WorkerSink::ClickHouse(w) => {
                        let before = w.group_rows;
                        w.provider_reference(&r).await?;
                        p.add(&p.group_rows, w.group_rows - before);
                    }
                    WorkerSink::Forward(tx) => {
                        if tx.send(Parsed::ProviderReference(r)).await.is_err() {
                            return Err(perr("publisher stopped"));
                        }
                    }
                    WorkerSink::Discard => {
                        p.add(&p.group_rows, r.provider_groups.len() as u64);
                    }
                }
            }
            Section::InNetwork => {
                let obj = match serde_json::from_slice::<InNetworkObject>(slice) {
                    Ok(o) => o,
                    Err(e) => {
                        record_error(&shared, &el, slice, &e.to_string())?;
                        continue;
                    }
                };
                let mut prices = 0u64;
                let mut rows = 0u64;
                for rate in &obj.negotiated_rate {
                    prices += rate.negotiated_prices.len() as u64;
                    rows += (rate.negotiated_prices.len() * rate.provider_references.len()) as u64;
                }
                p.add(&p.in_network, 1);
                p.add(&p.prices, prices);
                match &mut sink {
                    WorkerSink::ClickHouse(w) => {
                        let (before, skipped_before) = (w.rate_rows, w.zombie_skipped);
                        w.in_network(&obj).await?;
                        p.add(&p.rate_rows, w.rate_rows - before);
                        p.add(&p.zombie_skipped, w.zombie_skipped - skipped_before);
                    }
                    WorkerSink::Forward(tx) => {
                        if tx.send(Parsed::InNetwork(obj)).await.is_err() {
                            return Err(perr("publisher stopped"));
                        }
                    }
                    WorkerSink::Discard => p.add(&p.rate_rows, rows),
                }
            }
        }
        p.add(&p.bytes, (el.end - el.start) as u64);
    }

    if let WorkerSink::ClickHouse(w) = sink {
        let (rates, groups) = w.finish().await?;
        if cfg.threads <= 32 {
            println!("worker {}: finished ({} rate rows, {} provider_group rows)", id, rates, groups);
        }
    }
    Ok(())
}

fn record_error(shared: &Shared, el: &Element, slice: &[u8], msg: &str) -> Result<(), PipelineError> {
    let n = shared.progress.errors.fetch_add(1, Ordering::Relaxed) + 1;
    if n <= 10 {
        let snippet = String::from_utf8_lossy(&slice[..slice.len().min(160)]);
        eprintln!(
            "element error #{} ({:?} @ byte {}): {} — {}…",
            n, el.section, el.start, msg, snippet
        );
    }
    let max = shared.cfg.max_element_errors;
    if max > 0 && n > max {
        return Err(perr(format!(
            "aborting: {} elements failed to parse (PARSER_MAX_ELEMENT_ERRORS={})",
            n, max
        )));
    }
    Ok(())
}

fn spawn_progress_ticker(shared: Arc<Shared>, started: Instant) -> JoinHandle<()> {
    tokio::spawn(async move {
        let every = Duration::from_secs(shared.cfg.progress_secs);
        let mut last_bytes = 0u64;
        let mut last_t = Instant::now();
        loop {
            tokio::time::sleep(every).await;
            let p = &shared.progress;
            let bytes = p.get(&p.bytes);
            let now = Instant::now();
            let inst = (bytes - last_bytes) as f64 / now.duration_since(last_t).as_secs_f64() / 1e6;
            last_bytes = bytes;
            last_t = now;
            println!(
                "[{:>6.1}s] {:>5.1}% {:>7.0} MB/s | prov_refs {} | in_network {} | prices {} | rate_rows {} | group_rows {} | zombie_skipped {} | errors {}",
                started.elapsed().as_secs_f64(),
                bytes as f64 * 100.0 / shared.total_bytes.max(1) as f64,
                inst,
                p.get(&p.provider_refs),
                p.get(&p.in_network),
                p.get(&p.prices),
                p.get(&p.rate_rows),
                p.get(&p.group_rows),
                p.get(&p.zombie_skipped),
                p.get(&p.errors),
            );
        }
    })
}
