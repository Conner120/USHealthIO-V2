import { seenCount } from "./dedupe";
import { liveNodes } from "./heartbeat";
import { deadCount, inFlightCount } from "./inflight";
import { fileQueueKey, taskQueueKey } from "./keys";
import { length, range } from "./deque";
import { progress, type Progress } from "./ledger";
import { SIZE_TIERS, type SizeTier } from "./tiers";
import { TASK_KINDS, type FileJob, type Task, type TaskKind } from "./types";

interface QueueCounts {
  key: string;
  /** Waiting to be taken. */
  waiting: number;
  /** Taken by a node, not yet acked. */
  inflight: number;
  /** Parked after max attempts. */
  dead: number;
}

export interface FileQueueStatus extends QueueCounts {
  tier: SizeTier;
  label: string;
  /** Sum of sizeBytes over every waiting job in this tier. */
  waitingBytes: number;
  head: FileJob[];
}

export interface TaskQueueStatus extends QueueCounts {
  kind: TaskKind;
  head: Task[];
}

export interface QueueStatus {
  fetchedAt: Date;
  nodes: string[];
  progress: Progress;
  seenUrls: number;
  /** Sum of waitingBytes across all tiers — total still to download. */
  waitingBytes: number;
  files: FileQueueStatus[];
  tasks: TaskQueueStatus[];
}

async function counts(key: string): Promise<QueueCounts> {
  const [waiting, inflight, dead] = await Promise.all([length(key), inFlightCount(key), deadCount(key)]);
  return { key, waiting, inflight, dead };
}

/** Read-only snapshot of every queue plus run progress and live nodes. */
export async function getQueueStatus(peek = 5): Promise<QueueStatus> {
  const [files, tasks, nodes, prog, seenUrls] = await Promise.all([
    Promise.all(
      SIZE_TIERS.map(async (t) => {
        const key = fileQueueKey(t.name);
        const waiting = await range<FileJob>(key);
        const waitingBytes = waiting.reduce((sum, j) => sum + j.sizeBytes, 0);
        return { tier: t.name, label: t.label, ...(await counts(key)), waitingBytes, head: waiting.slice(0, peek) };
      }),
    ),
    Promise.all(
      TASK_KINDS.map(async (kind) => {
        const key = taskQueueKey(kind);
        return { kind, ...(await counts(key)), head: await range<Task>(key, 0, peek - 1) };
      }),
    ),
    liveNodes(),
    progress(),
    seenCount(),
  ]);
  const waitingBytes = files.reduce((sum, q) => sum + q.waitingBytes, 0);
  return { fetchedAt: new Date(), nodes: nodes.sort(), progress: prog, seenUrls, waitingBytes, files, tasks };
}
