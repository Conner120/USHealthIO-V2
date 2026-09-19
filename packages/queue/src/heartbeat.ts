/**
 * Node liveness. Each process refreshes `node:{id}` (with a TTL) on an
 * interval; a job whose owner has no key is considered orphaned by the
 * reaper. Stopping the heartbeat deletes the key so a graceful shutdown's
 * remaining in-flight jobs (which drain() finishes first) are never reaped.
 */
import { getRedis } from "./client";
import { settings } from "./settings";

export const nodeId = settings.nodeId;

export function nodeKey(id: string): string {
  return `node:${id}`;
}

export async function beat(id = nodeId, ttlMs = settings.heartbeatTtlMs): Promise<void> {
  await getRedis().set(nodeKey(id), String(Date.now()), "PX", ttlMs);
}

export async function isAlive(id: string): Promise<boolean> {
  return (await getRedis().exists(nodeKey(id))) === 1;
}

export async function liveNodes(): Promise<string[]> {
  const keys = await getRedis().keys(nodeKey("*"));
  return keys.map((k) => k.slice(nodeKey("").length));
}

let timer: ReturnType<typeof setInterval> | null = null;

/** Start refreshing this node's key. Idempotent. */
export async function startHeartbeat(intervalMs = settings.heartbeatIntervalMs): Promise<void> {
  if (timer) return;
  await beat();
  timer = setInterval(() => beat().catch((e) => console.error("[heartbeat] failed:", e)), intervalMs);
}

/** Stop refreshing and drop the key. Call after drain(). */
export async function stopHeartbeat(): Promise<void> {
  if (timer) clearInterval(timer);
  timer = null;
  await getRedis().del(nodeKey(nodeId));
}
