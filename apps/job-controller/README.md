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
