/**
 * Typed entry points for putting work into Redis. Ids, timestamps, tiers and
 * keys are filled in here.
 *
 *   enqueueTask("index-scan", { carrier: "uhc", type: "uhc-index-page" })
 *   enqueueFile({ url, sizeBytes })
 */
import { getRedis } from "./client";
import { encode } from "./codec";
import { seenKey, SCOPES_KEY } from "./dedupe";
import { pushBack } from "./deque";
import { TASKS_KEY } from "./ledger";
import { trackFile, trackTask } from "./ledger";
import { fileQueueKey, taskQueueKey } from "./keys";
import { tierFor } from "./tiers";
import type { FileJob, Task, TaskKind, TaskPayloadMap } from "./types";

export interface EnqueueOptions {
  scanJobId?: string;
}

/** Push a management task. `payload` is checked against TaskPayloadMap[kind]. */
export async function enqueueTask<K extends TaskKind>(
  kind: K,
  payload: TaskPayloadMap[K],
  opts: EnqueueOptions = {},
): Promise<Task<K>> {
  const task: Task<K> = {
    id: crypto.randomUUID(),
    kind,
    payload,
    createdAt: new Date(),
    attempts: 0,
    scanJobId: opts.scanJobId,
  };
  await trackTask();
  await pushBack(taskQueueKey(kind), task);
  return task;
}

export interface DedupedTaskInput<K extends TaskKind> {
  /** Dedupe key within the scope, e.g. the TOC url the task will scan. */
  url: string;
  payload: TaskPayloadMap[K];
}

export interface EnqueueBatchResult {
  enqueued: number;
  duplicates: number;
}

// KEYS: seen set, scopes set, task queue, tasks-pending counter.
// ARGV: scope, then (url, encoded task) pairs. Per url, atomically: skip if
// seen, else mark seen and push the task. One round-trip per chunk.
const FANOUT = `
redis.call('SADD', KEYS[2], ARGV[1])
local n = 0
for i = 2, #ARGV, 2 do
  if redis.call('SADD', KEYS[1], ARGV[i]) == 1 then
    redis.call('RPUSH', KEYS[3], ARGV[i + 1])
    n = n + 1
  end
end
if n > 0 then redis.call('INCRBY', KEYS[4], n) end
return n`;

export const FANOUT_CHUNK = 500;

/**
 * Push many management tasks, skipping any whose `url` was already seen in
 * `scope` (the top-level scan job id). Marks each url seen as it is queued,
 * so nothing needs an evaluation lock: there is no work between claim and
 * enqueue. Intended for fanning out follow-up index scans (tens of thousands
 * of TOCs) without a round-trip per task; workers can start taking tasks
 * after the first chunk lands.
 */
export async function enqueueTasksDeduped<K extends TaskKind>(
  scope: string,
  kind: K,
  inputs: DedupedTaskInput<K>[],
  chunk = FANOUT_CHUNK,
): Promise<EnqueueBatchResult> {
  const result: EnqueueBatchResult = { enqueued: 0, duplicates: 0 };
  const queue = taskQueueKey(kind);
  for (let i = 0; i < inputs.length; i += chunk) {
    const slice = inputs.slice(i, i + chunk);
    const argv: string[] = [scope];
    const createdAt = new Date();
    for (const { url, payload } of slice) {
      const task: Task<K> = { id: crypto.randomUUID(), kind, payload, createdAt, attempts: 0, scanJobId: scope };
      argv.push(url, encode(task));
    }
    const n = Number(await getRedis().eval(FANOUT, 4, seenKey(scope), SCOPES_KEY, queue, TASKS_KEY, ...argv));
    result.enqueued += n;
    result.duplicates += slice.length - n;
  }
  return result;
}

export interface EnqueueFileInput extends EnqueueOptions {
  url: string;
  sizeBytes: number;
  discoveredAt?: Date;
}

/** Push a file job onto the tier queue for its size. */
export async function enqueueFile(input: EnqueueFileInput): Promise<FileJob> {
  const tier = tierFor(input.sizeBytes);
  const job: FileJob = {
    id: crypto.randomUUID(),
    url: input.url,
    sizeBytes: input.sizeBytes,
    tier,
    discoveredAt: input.discoveredAt ?? new Date(),
    scanJobId: input.scanJobId,
  };
  await trackFile(job.url);
  await pushBack(fileQueueKey(tier), job);
  return job;
}
