/**
 * Cross-job URL deduplication with an evaluation lock.
 *
 * Index scans on different tasks/nodes discover the same file URLs (UHC's
 * shared network files appear in tens of thousands of TOCs). Before a URL is
 * evaluated (HEAD + enqueue) the worker claims it:
 *
 *   claimUrl(url)
 *     "seen"     already evaluated by some job  -> skip
 *     "locked"   another job is evaluating now  -> see withUrlClaim
 *     "claimed"  ours; must end with markSeen() or releaseUrl()
 *
 * Check + lock is one Lua script so two workers can't both claim between the
 * SISMEMBER and the SET. The lock value is "{node}:{token}" so a lock left by
 * a node that died mid-evaluation can be identified (no heartbeat) and stolen
 * by whoever the job was reassigned to; the TTL is only a last resort.
 * markSeen() adds the URL to the seen set and drops the lock.
 *
 * Everything is segmented by `scope` — the index-scan job id (Task.scanJobId)
 * that started the discovery tree — so two scan jobs running at once, or a
 * re-scan of the same carrier, never dedupe against each other:
 *
 *   mrf:seen:urls:{scope}      SET    evaluated URLs
 *   mrf:lock:{scope}:{sha1}    STRING evaluation lock
 *   mrf:seen:scopes            SET    every scope with a seen set (for cleanup)
 */
import { createHash } from "node:crypto";
import { getRedis } from "./client";
import { isAlive, nodeId } from "./heartbeat";

export const SEEN_PREFIX = "mrf:seen:urls:";
export const SCOPES_KEY = "mrf:seen:scopes";

export function seenKey(scope: string): string {
  return `${SEEN_PREFIX}${scope}`;
}
export const LOCK_TTL_MS = 5 * 60 * 1000;
/** How often a waiter re-checks a lock held by a live node. */
export const LOCK_POLL_MS = 500;

export type Claim = "claimed" | "seen" | "locked";

// KEYS: seen set, lock, scopes set.  ARGV: url, token, ttl, scope
const CLAIM_SCRIPT = `
if redis.call('SISMEMBER', KEYS[1], ARGV[1]) == 1 then return 'seen' end
if redis.call('SET', KEYS[2], ARGV[2], 'NX', 'PX', ARGV[3]) then
  redis.call('SADD', KEYS[3], ARGV[4])
  return 'claimed'
end
return 'locked:' .. redis.call('GET', KEYS[2])`;

/** Take over a lock only if it still holds exactly the value we saw. */
const STEAL_SCRIPT = `
if redis.call('GET', KEYS[1]) ~= ARGV[1] then return 0 end
redis.call('SET', KEYS[1], ARGV[2], 'PX', ARGV[3])
return 1`;

/** Only the owner (matching token) may delete the lock. */
const RELEASE_SCRIPT = `
if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('DEL', KEYS[1]) end
return 0`;

const MARK_SCRIPT = `
redis.call('SADD', KEYS[1], ARGV[1])
if redis.call('GET', KEYS[2]) == ARGV[2] then redis.call('DEL', KEYS[2]) end
return 1`;

export function lockKey(scope: string, url: string): string {
  return `mrf:lock:${scope}:${createHash("sha1").update(url).digest("hex")}`;
}

export interface UrlClaim {
  status: Claim;
  /** Our lock value; only set when status === "claimed". */
  token?: string;
  /** Current lock value "{node}:{token}"; only set when status === "locked". */
  heldBy?: string;
}

function newToken(node: string): string {
  return `${node}:${crypto.randomUUID()}`;
}

export function lockOwnerNode(lockValue: string): string {
  return lockValue.slice(0, lockValue.lastIndexOf(":"));
}

export async function claimUrl(scope: string, url: string, ttlMs = LOCK_TTL_MS, node = nodeId): Promise<UrlClaim> {
  const token = newToken(node);
  const res = (await getRedis().eval(CLAIM_SCRIPT, 3, seenKey(scope), lockKey(scope, url), SCOPES_KEY, url, token, String(ttlMs), scope)) as string;
  if (res === "claimed") return { status: "claimed", token };
  if (res === "seen") return { status: "seen" };
  return { status: "locked", heldBy: res.slice("locked:".length) };
}

/** Take over `url`'s lock from `heldBy` (a dead node). Null if it changed meanwhile. */
export async function stealUrl(scope: string, url: string, heldBy: string, ttlMs = LOCK_TTL_MS, node = nodeId): Promise<string | null> {
  const token = newToken(node);
  const ok = await getRedis().eval(STEAL_SCRIPT, 1, lockKey(scope, url), heldBy, token, String(ttlMs));
  return ok === 1 ? token : null;
}

/**
 * Claim `url`, resolving a lock held by someone else: steal it if the owning
 * node is dead, otherwise wait for the owner to finish. Never returns
 * "locked" — the outcome is always "seen" or "claimed".
 */
export async function claimUrlResolving(scope: string, url: string, ttlMs = LOCK_TTL_MS, node = nodeId): Promise<UrlClaim> {
  for (;;) {
    const claim = await claimUrl(scope, url, ttlMs, node);
    if (claim.status !== "locked") return claim;

    const owner = lockOwnerNode(claim.heldBy!);
    if (owner !== node && !(await isAlive(owner))) {
      const token = await stealUrl(scope, url, claim.heldBy!, ttlMs, node);
      if (token) {
        console.warn(`[dedupe] took over lock on ${url} from dead node ${owner}`);
        return { status: "claimed", token };
      }
      continue; // someone else got there first; re-evaluate
    }
    await new Promise((r) => setTimeout(r, LOCK_POLL_MS));
  }
}

/** Record the URL as evaluated and drop our lock. */
export async function markSeen(scope: string, url: string, token: string): Promise<void> {
  await getRedis().eval(MARK_SCRIPT, 2, seenKey(scope), lockKey(scope, url), url, token);
}

/** Give the URL back (evaluation failed) so another job can claim it. */
export async function releaseUrl(scope: string, url: string, token: string): Promise<void> {
  await getRedis().eval(RELEASE_SCRIPT, 1, lockKey(scope, url), token);
}

/**
 * Drop every evaluation lock held by *this* node id. Called at startup: a
 * lock from a previous instance with the same id (fixed NODE_ID, `bun --watch`
 * reload) would otherwise be waited on as "live" until its TTL.
 */
export async function releaseOwnLocks(node = nodeId): Promise<number> {
  const r = getRedis();
  let n = 0;
  for await (const keys of r.scanStream({ match: "mrf:lock:*", count: 200 })) {
    for (const key of keys as string[]) {
      const value = await r.get(key);
      if (value && lockOwnerNode(value) === node && (await r.eval(RELEASE_SCRIPT, 1, key, value)) === 1) n++;
    }
  }
  if (n) console.warn(`[dedupe] released ${n} url lock(s) left by a previous instance of ${node}`);
  return n;
}

export async function isSeen(scope: string, url: string): Promise<boolean> {
  return (await getRedis().sismember(seenKey(scope), url)) === 1;
}

/** Scopes (scan job ids) that currently have a seen set. */
export async function seenScopes(): Promise<string[]> {
  return getRedis().smembers(SCOPES_KEY);
}

/** Evaluated URLs per scope; with no scope, the total across all scopes. */
export async function seenCount(scope?: string): Promise<number> {
  const r = getRedis();
  if (scope) return r.scard(seenKey(scope));
  const counts = await Promise.all((await seenScopes()).map((s) => r.scard(seenKey(s))));
  return counts.reduce((a, b) => a + b, 0);
}

/** Forget every evaluated URL of one scope, or of all scopes. */
export async function clearSeen(scope?: string): Promise<void> {
  const r = getRedis();
  if (scope) {
    await r.multi().del(seenKey(scope)).srem(SCOPES_KEY, scope).exec();
    return;
  }
  const scopes = await seenScopes();
  await r.del(SCOPES_KEY, ...scopes.map(seenKey));
}

/**
 * Claim `url`, run `fn`, then mark it seen. Returns status "seen" when
 * another job already evaluated the URL. Waits out (or takes over) a lock
 * held by another job so no URL is ever skipped. Releases the lock if `fn`
 * throws.
 */
export async function withUrlClaim<T>(scope: string, url: string, fn: () => Promise<T>): Promise<{ status: Claim; value?: T }> {
  const claim = await claimUrlResolving(scope, url);
  if (claim.status !== "claimed") return { status: claim.status };
  try {
    const value = await fn();
    await markSeen(scope, url, claim.token!);
    return { status: "claimed", value };
  } catch (err) {
    await releaseUrl(scope, url, claim.token!);
    throw err;
  }
}
