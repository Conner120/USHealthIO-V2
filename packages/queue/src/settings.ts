/** Env-driven defaults for the ownership / recovery machinery. */
import { hostname } from "node:os";

const num = (name: string, fallback: number) => Number(process.env[name] ?? fallback);

/**
 * Unique per *instance*, not per process: `bun --watch` re-execs the script in
 * place (same pid, no signal, no exit hook), so a pid-based id would let the
 * reloaded instance inherit — and keep heartbeating for — jobs and locks the
 * old instance abandoned. With a fresh id those leftovers belong to a node
 * that stops beating and the reaper reassigns them. A fixed NODE_ID is still
 * honoured; recoverSelf() at startup handles that case.
 */
const instanceId = `${hostname()}-${process.pid}-${Math.random().toString(36).slice(2, 8)}`;

export const settings = {
  nodeId: process.env.NODE_ID ?? instanceId,
  /** How often a node refreshes its liveness key. */
  heartbeatIntervalMs: num("HEARTBEAT_INTERVAL_MS", 5_000),
  /** A node with no heartbeat for this long is dead; its jobs get reassigned. */
  heartbeatTtlMs: num("HEARTBEAT_TTL_MS", 30_000),
  /** How often to look for jobs owned by dead nodes. */
  reaperIntervalMs: num("REAPER_INTERVAL_MS", 30_000),
  /** Reassignments before a job is parked in {queue}:dead. */
  maxJobAttempts: num("MAX_JOB_ATTEMPTS", 3),
};
