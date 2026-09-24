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
//! Both ClickHouse and RabbitMQ need every provider group resolved before the first rate (the v2
//! ClickHouse schema keys `rate_seen` by TIN hash, not by the file-local provider_group_id), so
//! they run two passes: pass 1 collects `provider_references`, pass 2 streams `in_network`. The
//! second pass re-scans at >1 GB/s without decoding, which is negligible next to the parse itself.

use crate::config::{Config, SinkKind};
use crate::fetch::{http_client, resolve_location};
use crate::model::{FileHeader, InNetworkObject, ProviderReferenceObject};
use crate::scan::{scan, scan_header, Element, ScanError, ScanStats, Section};
use crate::sink::clickhouse::{seen_on_for, ClickHouseSink, ClickHouseWriter};
use crate::sink::rabbitmq::RabbitMqSink;
use memmap2::{Advice, Mmap, UncheckedAdvice};
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
    /// ClickHouse: `rate_seen` rows (one per price × TIN). Other sinks: price × provider ref pairs.
    rate_rows: AtomicU64,
    /// ClickHouse: distinct `rates` rows written this job. Other sinks: provider group rows.
    group_rows: AtomicU64,
    /// Rate rows dropped by `ZOMBIE_FILTER` (ClickHouse sink only).
    zombie_skipped: AtomicU64,
    /// `provider_references[]` ids with no provider_reference element (ClickHouse sink only).
    unresolved_refs: AtomicU64,
    /// Bytes of mmap page cache handed back to the kernel (see `Shared::release_scanned_pages`).
    released_bytes: AtomicU64,
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
    /// High-water mark (file offset) of pages already handed back to the kernel.
    released_upto: AtomicU64,
}

impl Shared {
    /// Tells the kernel it can drop the clean page-cache pages we have already scanned past.
    ///
    /// Without this the resident set grows to the whole file: every page the scanner touches stays
    /// resident until memory pressure evicts it, so a 50 GB file shows 50 GB of RSS. The mapping is
    /// a read-only view of a file, so every page is clean and `MADV_DONTNEED` can only cost a
    /// re-read if someone touches the range again — never data loss.
    ///
    /// Workers lag the scanner by up to `queue_depth` elements, so we release only up to
    /// `cursor - release_lag_bytes`. A worker that is further behind than that re-faults the pages
    /// it needs straight back from the file, which is correct, just slower.
    fn release_scanned_pages(&self, cursor: usize) {
        let chunk = self.cfg.mmap_release_bytes;
        if chunk == 0 {
            return;
        }
        let lag = self.cfg.mmap_release_lag_bytes;
        let target = (cursor as u64).saturating_sub(lag);
        let prev = self.released_upto.load(Ordering::Relaxed);
        if target < prev.saturating_add(chunk) {
            return;
        }
        // Align down: madvise needs page boundaries, and rounding down never drops a page that is
        // still partly ahead of the cursor.
        let aligned = target & !(RELEASE_ALIGN - 1);
        if aligned <= prev {
            return;
        }
        if self
            .released_upto
            .compare_exchange(prev, aligned, Ordering::Relaxed, Ordering::Relaxed)
            .is_err()
        {
            return; // another caller got there first
        }
        let len = (aligned - prev) as usize;
        // SAFETY: `buf` maps a read-only file. Every page is clean, so discarding it cannot lose
        // writes; a later access simply faults it back in from the file.
        unsafe {
            let _ = self
                .buf
                .unchecked_advise_range(UncheckedAdvice::DontNeed, prev as usize, len);
        }
        self.progress.add(&self.progress.released_bytes, len as u64);
    }
}

/// Alignment for `MADV_DONTNEED` ranges. 64 KiB is a multiple of every page size we run on
/// (4 KiB x86-64, 16 KiB Apple silicon, 4/16/64 KiB aarch64 Linux), and rounding the release
/// point *down* to it is always safe — it just leaves at most one boundary chunk resident.
const RELEASE_ALIGN: u64 = 64 * 1024;

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
        released_upto: AtomicU64::new(0),
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
        "parser: done in {:.2?} — {} provider_references, {} in_network objects, {} prices, {} rate rows, {} distinct rates / provider_group rows, {} zombie rows skipped ({:?}), {} unresolved provider refs, {} element errors",
        started.elapsed(),
        p.get(&p.provider_refs),
        p.get(&p.in_network),
        p.get(&p.prices),
        p.get(&p.rate_rows),
        p.get(&p.group_rows),
        p.get(&p.zombie_skipped),
        shared.cfg.zombie_filter,
        p.get(&p.unresolved_refs),
        p.get(&p.errors),
    );
    if p.get(&p.released_bytes) > 0 {
        println!("parser: released {:.2} GB of scanned mmap pages", p.get(&p.released_bytes) as f64 / 1e9);
    }
    result
}

// ------------------------------------------------------------------------------------ drivers

async fn run_clickhouse(shared: Arc<Shared>, job_id: &str) -> Result<(), PipelineError> {
    let sink = ClickHouseSink::connect(&shared.cfg.clickhouse, job_id).await?;
    println!(
        "sink: clickhouse {} db={} ({} rows / {} MiB per INSERT per worker, {})",
        shared.cfg.clickhouse.url,
        shared.cfg.clickhouse.database,
        shared.cfg.clickhouse.insert_max_rows,
        shared.cfg.clickhouse.insert_max_bytes / 1048576,
        shared.cfg.clickhouse.retry.describe()
    );
    // Pass 1: provider references, written as they are parsed. The writer holds only the
    // batches it has yet to send plus the local id -> TIN hash map that pass 2 needs; the
    // reference objects themselves are dropped as soon as their rows are queued, so this pass
    // does not grow with the size of the provider_references section.
    //
    // `seen_on` comes from the file header, which the scanner fills before the first element, so
    // it is read from a shared cell once pass 1 has started rather than after it finishes.
    // The publication date has to be known before the first row is written, so probe the header
    // first (cheap: it stops at the first array once it has the date).
    let seen_on = seen_on_for(&scan_header(&shared.buf)?);
    let (tx, mut rx) = mpsc::channel::<Parsed>(shared.cfg.queue_depth);
    let mut writer = sink.provider_group_writer(seen_on);
    let collector: JoinHandle<Result<(u64, u64), PipelineError>> = tokio::spawn(async move {
        while let Some(p) = rx.recv().await {
            if let Parsed::ProviderReference(r) = p {
                writer.write(&r).await?;
            }
        }
        Ok(writer.finish().await?)
    });
    let (header, ref_stats) = run_pass(shared.clone(), &[Section::ProviderReferences], || {
        WorkerSink::Forward(tx.clone())
    })
    .await?;
    drop(tx);
    let (tin_rows, seen_rows) = collector.await.map_err(|e| perr(format!("collector: {}", e)))??;
    println!(
        "clickhouse: pass 1 done — {} provider_references → {} distinct TINs, {} provider_group_seen rows (seen_on {})",
        ref_stats.provider_reference_elements, tin_rows, seen_rows, seen_on
    );

    // Pass 2: rates.
    let (_, stats) = run_pass(shared.clone(), &[Section::InNetwork], || {
        WorkerSink::ClickHouse(sink.writer(shared.cfg.zombie_filter, seen_on))
    })
    .await?;
    let p = &shared.progress;
    sink.file_meta(
        &header,
        ref_stats.provider_reference_elements,
        stats.in_network_elements,
        p.get(&p.rate_rows),
    )
    .await?;
    println!(
        "clickhouse: {} INSERT statements completed, {} distinct rates",
        sink.statements(),
        sink.distinct_rates()
    );
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
    // Each pass walks the file from the start again, so the release cursor resets with it.
    shared.released_upto.store(0, Ordering::Relaxed);

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
                let end = el.end;
                tx.send(el).map_err(|_| ScanError {
                    message: "all workers stopped".to_string(),
                })?;
                // Hand back everything we are safely past, so RSS stays flat instead of growing
                // to the size of the file.
                shared.release_scanned_pages(end);
                Ok(())
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
                    WorkerSink::ClickHouse(_) => {
                        // ClickHouse runs provider references through pass 1 (Forward); a rates
                        // writer never sees this section.
                        return Err(perr("provider_reference element reached a ClickHouse rates writer"));
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
                        let before = (w.rate_rows, w.seen_rows, w.zombie_skipped, w.unresolved_refs);
                        w.in_network(&obj).await?;
                        p.add(&p.group_rows, w.rate_rows - before.0);
                        p.add(&p.rate_rows, w.seen_rows - before.1);
                        p.add(&p.zombie_skipped, w.zombie_skipped - before.2);
                        p.add(&p.unresolved_refs, w.unresolved_refs - before.3);
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
        let (rates, seen) = w.finish().await?;
        if cfg.threads <= 32 {
            println!("worker {}: finished ({} rates rows, {} rate_seen rows)", id, rates, seen);
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
