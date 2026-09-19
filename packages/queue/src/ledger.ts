/**
 * Run ledger: how much enqueued work is still outstanding, across all nodes.
 *
 *   mrf:ledger:tasks   counter — +1 per enqueued task,  -1 per finishTask()
 *   mrf:ledger:files   counter — +1 per enqueued file,  -1 per finishFile()
 *   mrf:failed:urls    set     — files that failed, kept for review
 *
 * When both counters reach 0 the run is complete: counters and the seen-URL
 * set (dedupe.ts) are cleared so the next discovery starts fresh. Failed
 * files never block completion.
 */
import { getRedis } from "./client";
import { SCOPES_KEY, SEEN_PREFIX } from "./dedupe";

export const TASKS_KEY = "mrf:ledger:tasks";
export const FILES_KEY = "mrf:ledger:files";
export const FILE_FAILED_KEY = "mrf:failed:urls";
/** url -> FileJob.id per scope (written by the index-scan worker): mrf:file:job:{scope}. */
export const FILE_JOBS_PREFIX = "mrf:file:job:";

export function fileJobsKey(scope: string): string {
  return `${FILE_JOBS_PREFIX}${scope}`;
}

// Decrement one counter; if both are now <= 0, reset the run. Returns 1 on reset.
const FINISH = `
redis.call('DECR', KEYS[1])
local tasks = tonumber(redis.call('GET', KEYS[2]) or 0)
local files = tonumber(redis.call('GET', KEYS[3]) or 0)
if tasks <= 0 and files <= 0 then
  for _, scope in ipairs(redis.call('SMEMBERS', KEYS[4])) do
    redis.call('DEL', ARGV[1] .. scope, ARGV[2] .. scope)
  end
  redis.call('DEL', KEYS[2], KEYS[3], KEYS[4])
  return 1
end
return 0`;

async function finish(counterKey: string): Promise<boolean> {
  const done = await getRedis().eval(FINISH, 4, counterKey, TASKS_KEY, FILES_KEY, SCOPES_KEY, SEEN_PREFIX, FILE_JOBS_PREFIX);
  return done === 1;
}

export async function trackTask(): Promise<void> {
  await getRedis().incr(TASKS_KEY);
}

export async function trackFile(_url: string): Promise<void> {
  await getRedis().incr(FILES_KEY);
}

/** A task finished (any outcome). True when it was the last outstanding work. */
export function finishTask(): Promise<boolean> {
  return finish(TASKS_KEY);
}

/** A file finished. Failed files are remembered in FILE_FAILED_KEY. */
export async function finishFile(url: string, opts: { failed?: boolean } = {}): Promise<boolean> {
  if (opts.failed) await getRedis().sadd(FILE_FAILED_KEY, url);
  return finish(FILES_KEY);
}

export interface Progress {
  pendingTasks: number;
  pendingFiles: number;
  failedFiles: number;
}

export async function progress(): Promise<Progress> {
  const r = getRedis();
  const [tasks, files, failed] = await Promise.all([r.get(TASKS_KEY), r.get(FILES_KEY), r.scard(FILE_FAILED_KEY)]);
  return { pendingTasks: Number(tasks ?? 0), pendingFiles: Number(files ?? 0), failedFiles: failed };
}

/** Reset counters, failed set and seen set. For tests / a manual restart. */
export async function clearLedger(): Promise<void> {
  const r = getRedis();
  const scopes = await r.smembers(SCOPES_KEY);
  await r.del(TASKS_KEY, FILES_KEY, FILE_FAILED_KEY, SCOPES_KEY, ...scopes.map((s) => SEEN_PREFIX + s), ...scopes.map(fileJobsKey));
}
