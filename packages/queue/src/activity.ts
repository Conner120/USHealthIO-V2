/**
 * What each node is doing right now, shared through Redis so any node's dashboard can show the
 * whole cluster.
 *
 *   node:{id}:activity   JSON snapshot, refreshed on the heartbeat interval, TTL'd like the
 *                        liveness key so a dead node's activity disappears with it.
 *
 * This is display-only state: it is never read back into the queue logic, and a missing or stale
 * snapshot only means "that node has not reported yet".
 */
import { getRedis } from "./client";
import { liveNodes, nodeId, nodeKey } from "./heartbeat";
import { settings } from "./settings";

/** One job running on a node, with whatever progress that step can report. */
export interface JobActivity {
  id: string;
  url: string;
  /** Short file name, for display. */
  name: string;
  tier: string;
  /** Download size as queued — compressed for .gz (what HEAD reported). */
  sizeBytes: number;
  /** Bytes actually downloaded, once the download finished. Null while downloading. */
  downloadBytes: number | null;
  /**
   * Uncompressed size. Null until the file is staged; before that the UI shows
   * `stagingBytes` as an estimate.
   */
  jsonBytes: number | null;
  /** Reserved staging footprint (sizeBytes x expansion ratio) — the pre-staging estimate. */
  stagingBytes: number;
  step: "downloading" | "decompressing" | "parsing" | "cleaning";
  /** 0..1 within the current step, or null when the step cannot report progress. */
  stepProgress: number | null;
  /** Bytes fetched so far (downloading) or staged (later steps). */
  bytesDone: number;
  startedAt: string;
  stepStartedAt: string;
  /** Last line of parser output, while parsing. */
  detail?: string;
}

export interface NodeActivity {
  nodeId: string;
  role: string;
  updatedAt: string;
  startedAt: string;
  /** Jobs running on this node right now. */
  jobs: JobActivity[];
  /** Management tasks running right now. */
  tasks: { id: string; kind: string; scanJobId?: string; startedAt: string }[];
  storage: {
    totalBytes: number;
    reservedBytes: number;
    maxFileBytes: number;
    expansionRatio: number;
    stagingDir: string;
  } | null;
  limits: { maxConcurrentFiles: number; maxConcurrentTasks: number };
  /** Totals since this node started. */
  completed: { files: number; failedFiles: number; tasks: number; failedTasks: number };
}

export function activityKey(id: string): string {
  return `${nodeKey(id)}:activity`;
}

/** Publish this node's snapshot. TTL matches the heartbeat so it expires with the node. */
export async function publishActivity(a: NodeActivity, ttlMs = settings.heartbeatTtlMs): Promise<void> {
  await getRedis().set(activityKey(a.nodeId), JSON.stringify(a), "PX", ttlMs);
}

export async function clearActivity(id = nodeId): Promise<void> {
  await getRedis().del(activityKey(id));
}

/** Every live node's snapshot, newest first. Nodes that have not reported yet are skipped. */
export async function readClusterActivity(): Promise<NodeActivity[]> {
  const ids = await liveNodes();
  if (ids.length === 0) return [];
  const raw = await getRedis().mget(...ids.map(activityKey));
  const out: NodeActivity[] = [];
  for (const r of raw) {
    if (!r) continue;
    try {
      out.push(JSON.parse(r) as NodeActivity);
    } catch {
      // A truncated snapshot is not worth failing a dashboard request over.
    }
  }
  return out.sort((a, b) => a.nodeId.localeCompare(b.nodeId));
}
