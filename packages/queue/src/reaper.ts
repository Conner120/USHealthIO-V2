/**
 * Hands in-flight jobs of dead nodes back to their queue. Any node may run
 * it; compare-and-move in inflight.requeue() makes concurrent reapers safe.
 */
import { isAlive } from "./heartbeat";
import { listInFlight, reclaimOwned, requeue } from "./inflight";
import { releaseOwnLocks } from "./dedupe";
import { fileQueueKey, taskQueueKey } from "./keys";
import { settings } from "./settings";
import { SIZE_TIERS } from "./tiers";
import { TASK_KINDS } from "./types";

export interface ReapResult {
  requeued: number;
  dead: number;
}

/** Every queue key this service uses. */
export function allQueueKeys(): string[] {
  return [...SIZE_TIERS.map((t) => fileQueueKey(t.name)), ...TASK_KINDS.map(taskQueueKey)];
}

/** One pass over `queueKeys`. Jobs owned by a node with no heartbeat are requeued (or parked). */
/**
 * Startup recovery for this node id: requeue jobs and release URL locks a
 * previous instance with the same id left behind. Run once, right after the
 * heartbeat starts and before polling. Safe when there is nothing to do.
 */
export async function recoverSelf(queueKeys = allQueueKeys()): Promise<{ requeued: number; locksReleased: number }> {
  const [requeued, locksReleased] = await Promise.all([reclaimOwned(queueKeys), releaseOwnLocks()]);
  return { requeued, locksReleased };
}

export async function reapDeadJobs(queueKeys = allQueueKeys(), maxAttempts = settings.maxJobAttempts): Promise<ReapResult> {
  const result: ReapResult = { requeued: 0, dead: 0 };
  const alive = new Map<string, boolean>();

  for (const queueKey of queueKeys) {
    for (const { raw, entry } of await listInFlight(queueKey)) {
      if (!alive.has(entry.node)) alive.set(entry.node, await isAlive(entry.node));
      if (alive.get(entry.node)) continue;

      const outcome = await requeue(queueKey, entry, raw, maxAttempts);
      if (!outcome) continue; // another reaper got it
      result[outcome]++;
      console.warn(`[reaper] ${entry.node} is dead; ${entry.item.id} → ${outcome}`);
    }
  }
  return result;
}

let timer: ReturnType<typeof setInterval> | null = null;

/** Run reapDeadJobs on an interval. Idempotent. */
export function startReaper(intervalMs = settings.reaperIntervalMs): void {
  if (timer) return;
  timer = setInterval(() => reapDeadJobs().catch((e) => console.error("[reaper] failed:", e)), intervalMs);
}

export function stopReaper(): void {
  if (timer) clearInterval(timer);
  timer = null;
}
