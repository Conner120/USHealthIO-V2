# job-controller

Bun service that runs Redis-backed job queues. A node is either a **file node**
(pulls TiC MRF files by size tier, RAM disk or regular disk) or a
**management node** (runs non-file tasks like discovery and cleanup).

## Layout

```
src/
  index.ts             entry — connects, then runs the poll loop
  config.ts            typed env access
  tiers.ts             size tiers + Redis queue key per tier
  clients/
    clickhouse.ts      @clickhouse/client (same DB the parser writes to)
    redis.ts           Bun.redis client
  lib/redis/           see lib/redis/README.md
    enqueue.ts         enqueueTask(kind, payload) / enqueueFile({url,sizeBytes}) — typed
    deque.ts           Redis list ops (RPUSH/LPUSH/LPOP/LINDEX/LLEN/LRANGE/DEL)
    codec.ts           JSON encode/decode for payloads; Dates round-trip
  queue/
    deque.ts           Deque<T> — Redis list ops, written once
    file-queue.ts      FileQueue<T> — per-tier deque for file nodes
    task-queue.ts      TaskQueue<T> — named deque for management nodes
    index-scan/
      index.ts         runIndexScan(payload) — dispatch on payload.type
      worker.ts        processIndexScan — scan, enqueue FileJobs / follow-up TOC scans
      payloads.ts      generic payloads: toc | page | listing (+ carrier unions)
      types.ts         DiscoveredFile, Scanner<P>
      scans/           generic scanners, one file per type
        uhc/           UnitedHealthcare sub-types: uhc-index-page, uhc-toc
    management/
      index.ts         createManagementQueue(kind)
      task.ts          Task + TaskKind + ManagementQueue (one per kind)
      worker.ts        processTask (your code); pollTaskQueue with concurrency + retries
    tic/
      index.ts           createNodeQueue(tier)
      file-queue.ts      FileJob + TicFileQueue (= FileQueue<FileJob>)
      storage-budget.ts  tracks staging space + per-file limit on this node
      intake.ts          takeNext / takeWhileRoom — pop, reserve, or send back
      worker.ts          processJob (your code); pollQueue starts jobs in background
```

## Size tiers

| Tier | File size         | Redis key      |
| ---- | ----------------- | -------------- |
| xs   | < 250 MB          | `mrf:queue:xs` |
| sm   | < 1 GB            | `mrf:queue:sm` |
| md   | < 5 GB            | `mrf:queue:md` |
| lg   | < 25 GB           | `mrf:queue:lg` |
| xl   | >= 25 GB          | `mrf:queue:xl` |

## Storage

| Env              | Meaning                                                    |
| ---------------- | ---------------------------------------------------------- |
| `MANAGEMENT_NODE`| `true` = run task queues, `false` = run file queues        |
| `RAM_NODE`       | file nodes: `true` = RAM disk, `false` = disk              |
| `RAM_DISK_TOTAL` | staging space on a RAM node (e.g. `8GB`)                   |
| `DISK_TOTAL`     | staging space on a disk node (e.g. `500GB`)                |
| `MAX_FILE_BYTES` | largest single file this node accepts (defaults to total)  |

`takeNext(queue)` pops a job and reserves its size. If the node is full the job
is pushed back to the head of the queue (`no_room`); if it exceeds
`MAX_FILE_BYTES` it is returned as `too_large` and not requeued.
`takeWhileRoom(queue)` keeps pulling until the node is full. Call
`storageBudget.release(job.sizeBytes)` when a file is done.

## Management tasks

Task queues are keyed `task:queue:{kind}` (`index-scan`, `discovery`, `cleanup` —
extend `TaskKind`). `pollTaskQueue` starts tasks until `MAX_CONCURRENT_TASKS`
are running; a failed task is pushed back with `attempts+1` until
`MAX_TASK_ATTEMPTS`. Implement `processTask` in `queue/management/worker.ts`.

## Enqueuing work

```ts
import { enqueueTask, enqueueFile } from "./lib/redis";

await enqueueTask("index-scan", { carrier: "uhc", type: "uhc-index-page" });
await enqueueFile({ url: "https://…/in-network.json.gz", sizeBytes: 3_200_000_000 });
```

`enqueueTask` types `payload` from `TaskPayloadMap[kind]` (see
`queue/management/task.ts` — add a kind there and it's typed everywhere).
`enqueueFile` picks the tier from `sizeBytes`. Ids and timestamps are filled in.

## Index scans

An `index-scan` task carries an `IndexScanPayload` discriminated on `type`.
`processIndexScan` runs the scanner; results tagged `table-of-contents` become
follow-up index-scan tasks, everything else becomes a `FileJob` (size via HEAD
if missing) on the tier queue for its size.

Generic types: `toc`, `page`, `listing`. Carrier sub-types live in
`scans/<carrier>/` — currently UHC (`uhc-index-page` → `uhc-toc`). To add one:
payload interface in `scans/<carrier>/payloads.ts`, a `Scanner<P>`, add it to
the `IndexScanPayload` union and `SCANNERS`.

## Testing with real queues

```bash
bun send uhc                                   # UHC index-scan (listing page)
bun send uhc UnitedHealthcare-Insurance-Company # only that entity's index files
bun send uhc-toc <index-json-url>              # scan one UHC index JSON
bun queues --peek                              # lengths + head item of every queue
bun clear                                      # empty everything (or: files | tasks)
```

Run `MANAGEMENT_NODE=true bun dev` in another terminal and watch it pick the
task up; the TOC scans it spawns fill `mrf:queue:*` for file nodes.

## Run

```bash
cp .env.example .env   # fill in CLICKHOUSE_* and REDIS_URL
bun install
bun dev                # watch mode
bun test
```

## Running the file queue

A file job goes through four steps on a file node. Each is its own module under
`src/queue/tic/`, so a step can be tested or replaced on its own:

| # | Step | Where | Notes |
|---|------|-------|-------|
| 1 | **download** | `stage.ts` → `download()` | streams the URL to `<STAGING_DIR>/<job id>/<name>`; follows redirects |
| 2 | **decompress** | `stage.ts` → `decompress()` | `gunzip`/`unzip`/`zstd -d`/`bunzip2` by extension; skipped for plain `.json` |
| 3 | **parse** | `parser.ts` → `runParser()` | `parser-rs <file.json> in_network_rates <job id>`; output streamed to this log |
| 4 | **cleanup** | `stage.ts` → `cleanup()` | `rm -rf <STAGING_DIR>/<job id>`, in a `finally` so it runs on failure too |

### Space budgeting

`FileJob.sizeBytes` is the **compressed** download size (what the carrier's `HEAD` reported), but
the parser mmaps plain JSON. Before a job starts, the node reserves

```
stagingBytes = sizeBytes × COMPRESSED_EXPANSION_RATIO   (default 15, for .gz/.zip/.zst/.bz2)
stagingBytes = sizeBytes                                (for .json/.ndjson/.csv — nothing to expand)
```

An extension we don't recognise is assumed compressed (the safe direction). `MAX_FILE_BYTES` is
compared against this footprint, **not** the download — so with the default 15×, a 10 GB `.gz`
needs `MAX_FILE_BYTES` ≥ 150 GB to be accepted.

Once the file is staged the guess is replaced by the real size (`budget.adjustJob`), so a file
that expanded 9× stops holding 15× for the rest of the run, and one that expanded 40× is logged
(raise `COMPRESSED_EXPANSION_RATIO` if that is common for your carrier).

Parallelism is capped by `MAX_CONCURRENT_FILES`, not by the budget: a 500 GB node would otherwise
start thousands of small downloads at once.

### Steps to run it

```bash
# 0. once: build the parser the file node shells out to
cd ../../parser-tools/parser-rs && cargo build --release && cd -

# 1. apply the ClickHouse schema (targets CLICKHOUSE_DATABASE; refuses health / health-dev)
CLICKHOUSE_DATABASE=health-ai bun scripts/apply-clickhouse-schema.ts

# 2. discover files -> fills the tier queues (management role)
bun scripts/send.ts uhc <entity-filter>      # prints the scan job id it is scoped to
MANAGEMENT_NODE=true FILE_NODE=false bun src/index.ts

# 3. process them (file role). Both roles can run on one node:
MANAGEMENT_NODE=true FILE_NODE=true SINK=clickhouse CLICKHOUSE_DATABASE=health-ai bun src/index.ts

# 4. watch
bun scripts/queues.ts            # waiting / inflight / dead per queue, live nodes, ledger
bun scripts/queues.ts reap       # reassign jobs owned by dead nodes
```

A node with `MANAGEMENT_NODE=true FILE_NODE=true` runs both poll loops side by side, each with its
own concurrency limit (`MAX_CONCURRENT_TASKS` / `MAX_CONCURRENT_FILES`).

### Job records in ClickHouse

Every operation is also reported to `health.job_runs`, so job status is queryable rather than only
visible on a dashboard. A row is written when a job starts, on each step transition and at the end;
the table is a `ReplacingMergeTree(updated_at)` keyed by `run_id`, so `FINAL` is the current state
of every job across every node.

The final write attaches that operation's **console output** (`log`, tail-truncated to
`JOB_LOG_MAX_BYTES`, ZSTD-compressed), which is what makes it outlive the local log directory —
that is cleared on the next boot.

```sql
-- what is running right now, everywhere
SELECT node_id, kind, label, step, duration_ms FROM health.job_runs FINAL WHERE status = 'running';

-- failures in this scan, with the reason and the tail of their output
SELECT label, error, log FROM health.job_runs FINAL
WHERE scan_job_id = '<scan job>' AND status = 'failed';

-- throughput of a run
SELECT status, count(), sum(json_bytes) FROM health.job_runs FINAL
WHERE scan_job_id = '<scan job>' GROUP BY status;
```

For a file job `run_id` is the `FileJob.id`, which is also `insurance_scan_job_id` on the rows the
parser wrote — so `job_runs` joins straight to `mrf_files` / `rate_seen`.

Reporting is best-effort: a ClickHouse hiccup drops the batch with a warning rather than failing
the job (the dashboard and the local log files still have the same information). Set
`JOB_RECORDS_ENABLED=false` to turn it off.

### Stopping a node

| Action | Effect |
|--------|--------|
| 1st `Ctrl-C` / `SIGTERM` | stop taking new work, finish in-flight jobs. Poll loops wake immediately, so this is instant unless a job is running. |
| 2nd `Ctrl-C` | force quit now: kills the parser processes and exits 130 |
| `SHUTDOWN_TIMEOUT_MS` (default 30s, 0 = never) | force quit on its own if the graceful phase takes too long |

Forcing is safe: a job that does not finish stays in `{queue}:inflight` under this node's id, its
heartbeat stops, and the reaper reassigns it. The work is redone, not lost — which is also why the
node prints what it is waiting for instead of just sitting there.

Note the parser runs as a **separate process**: without the kill it would keep running (and keep
writing to ClickHouse) after the node exits, so both force paths signal it explicitly.

### Crash recovery

Staging directories are per job and removed in step 4. If a node dies mid-job, the reaper hands
the job to another node (see `lib/redis`), and the restarted node clears whatever it left behind
in `STAGING_DIR` before polling (`sweepStagingDir`, called once at startup — safe because a node
owns no jobs at that point).

## Dashboard

Every node serves a read-only web UI showing what the **whole cluster** is doing: each live node,
the jobs it is running with per-step progress (downloading → decompressing → parsing → cleaning),
its staging budget, queue depths and run progress. It only reads — it never enqueues, takes or
clears anything, so leaving it open cannot affect a run.

```bash
bun src/index.ts             # random free port, opens your browser
WEB_PORT=3000 bun src/index.ts   # pinned port, no browser (servers/containers)
WEB_ENABLED=false bun src/index.ts   # off
```

| Var | Default | Effect |
|-----|---------|--------|
| `WEB_ENABLED` | `true` | serve the dashboard |
| `WEB_PORT` | *(unset)* | unset → bind `:0` (OS picks a free port) **and** open a browser once; set → that port, no browser |
| `WEB_OPEN` | *(unset)* | force (`true`) or suppress (`false`) the browser regardless of `WEB_PORT` |

Nodes publish their activity to `node:{id}:activity` in Redis with the same TTL as the heartbeat,
so any node's dashboard shows every live node and a dead node drops off on its own.

### Console output

Every row — a running file job, or any operation in the **Operations** table — expands to show
that operation's console output, streaming while it runs. For a file job that is the four steps
plus everything the parser printed; for a management task it is the task's own output.

Lines are kept in memory for the live view (`LOG_KEEP_LINES`, default 500) and appended to
`<LOG_DIR>/<id>.log` so a finished operation can still be opened. `LOG_DIR` defaults to
`./tmp/job-logs` — the project's tmp dir — and is **cleared at startup**, so history means "since
this node booted". `LOG_KEEP_RUNS` (default 200) bounds the Operations list.

Logs are local to the node that ran the work, so expanding a job that ran on another node says so
rather than showing nothing.

| Endpoint | Returns |
|----------|---------|
| `GET /` | the page |
| `GET /api/status` | one JSON snapshot: cluster activity, queues, progress, operations list |
| `GET /api/logs/:id?since=N` | console output for one operation; `since` returns only newer lines |
