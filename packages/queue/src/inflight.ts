/**
 * Reliable take/ack on a queue list. A taken job is moved — atomically — from
 * the list into `{queue}:inflight` (HASH id -> InFlight) tagged with the
 * owning node, so it exists in exactly one place at all times:
 *
 *   take()     LPOP list + HSET inflight     (Lua)
 *   ack()      HDEL inflight                  job done, any outcome
 *   nack()     HDEL inflight + LPUSH list     give it back (e.g. no room)
 *   requeue()  same as nack but attempts+1; used by the reaper for dead owners
 *
 * Items must carry an `id`. `attempts` is bumped on requeue.
 */
import { getRedis } from "./client";
import { decode, encode } from "./codec";
import { nodeId } from "./heartbeat";

export interface Owned {
  id: string;
  attempts?: number;
}

export interface InFlight<T extends Owned = Owned> {
  item: T;
  node: string;
  startedAt: Date;
}

export function inflightKey(queueKey: string): string {
  return `${queueKey}:inflight`;
}

export function deadKey(queueKey: string): string {
  return `${queueKey}:dead`;
}

const TAKE = `
local raw = redis.call('LPOP', KEYS[1])
if not raw then return nil end
local item = cjson.decode(raw)
local entry = cjson.encode({ item = item, node = ARGV[1], startedAt = ARGV[2] })
redis.call('HSET', KEYS[2], item.id, entry)
return raw`;

// Only moves the entry if it is still exactly what the caller saw, so two
// reapers (or a reaper racing an ack) can't requeue the same job twice.
const RETURN = `
if redis.call('HGET', KEYS[2], ARGV[1]) ~= ARGV[2] then return 0 end
redis.call('HDEL', KEYS[2], ARGV[1])
redis.call('LPUSH', KEYS[1], ARGV[3])
return 1`;

const PARK = `
if redis.call('HGET', KEYS[2], ARGV[1]) ~= ARGV[2] then return 0 end
redis.call('HDEL', KEYS[2], ARGV[1])
redis.call('RPUSH', KEYS[3], ARGV[2])
return 1`;

export async function take<T extends Owned>(queueKey: string, node = nodeId): Promise<T | null> {
  const raw = (await getRedis().eval(TAKE, 2, queueKey, inflightKey(queueKey), node, new Date().toISOString())) as string | null;
  return raw == null ? null : decode<T>(raw);
}

export async function ack(queueKey: string, id: string): Promise<void> {
  await getRedis().hdel(inflightKey(queueKey), id);
}

/** Put an in-flight job back at the head of its queue unchanged. */
export async function nack<T extends Owned>(queueKey: string, item: T): Promise<boolean> {
  const raw = await getRedis().hget(inflightKey(queueKey), item.id);
  if (raw == null) return false;
  return (await getRedis().eval(RETURN, 2, queueKey, inflightKey(queueKey), item.id, raw, encode(item))) === 1;
}

/**
 * Reassign an orphaned job: back to the head with attempts+1, or into
 * `{queue}:dead` once it has used up `maxAttempts`. `expectedRaw` is the
 * entry as the caller read it. Returns what happened, or null if the entry
 * changed underneath us (someone else handled it).
 */
export async function requeue(
  queueKey: string,
  entry: InFlight,
  expectedRaw: string,
  maxAttempts: number,
): Promise<"requeued" | "dead" | null> {
  const attempts = (entry.item.attempts ?? 0) + 1;
  const r = getRedis();
  if (attempts >= maxAttempts) {
    const ok = await r.eval(PARK, 3, queueKey, inflightKey(queueKey), deadKey(queueKey), entry.item.id, expectedRaw);
    return ok === 1 ? "dead" : null;
  }
  const item = { ...entry.item, attempts };
  const ok = await r.eval(RETURN, 2, queueKey, inflightKey(queueKey), entry.item.id, expectedRaw, encode(item));
  return ok === 1 ? "requeued" : null;
}

/** Every in-flight entry for a queue, with the raw value for compare-and-move. */
export async function listInFlight<T extends Owned>(queueKey: string): Promise<Array<{ raw: string; entry: InFlight<T> }>> {
  const all = await getRedis().hgetall(inflightKey(queueKey));
  return Object.values(all).map((raw) => ({ raw, entry: decode<InFlight<T>>(raw) }));
}

/**
 * Requeue every in-flight entry that claims to be owned by *this* node id.
 * Called at startup: a job can't legitimately be in flight on a node that
 * just started, so these are leftovers from a previous instance with the same
 * id (fixed NODE_ID, or a `bun --watch` reload). Attempts are not bumped —
 * the job never ran to a failure.
 */
export async function reclaimOwned(queueKeys: string[], node = nodeId): Promise<number> {
  let n = 0;
  for (const key of queueKeys) {
    for (const { raw, entry } of await listInFlight(key)) {
      if (entry.node !== node) continue;
      const ok = await getRedis().eval(RETURN, 2, key, inflightKey(key), entry.item.id, raw, encode(entry.item));
      if (ok === 1) {
        n++;
        console.warn(`[inflight] ${key} ${entry.item.id}: left in flight by a previous instance of ${node}, requeued`);
      }
    }
  }
  return n;
}

export async function inFlightCount(queueKey: string): Promise<number> {
  return getRedis().hlen(inflightKey(queueKey));
}

export async function deadCount(queueKey: string): Promise<number> {
  return getRedis().llen(deadKey(queueKey));
}
