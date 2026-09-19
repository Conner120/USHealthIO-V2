import type { FileJob, TicFileQueue } from "./file-queue";
import { storageBudget, type StorageBudget } from "./storage-budget";

export type IntakeResult =
  | { status: "taken"; job: FileJob }
  | { status: "no_room"; job: FileJob } // sent back to the head of the queue
  | { status: "too_large"; job: FileJob } // over MAX_FILE_BYTES; not requeued
  | { status: "empty" };

/**
 * Take the next job (owned by this node until acked) and reserve space for
 * it. If the node is full the job goes back to the front of the queue. Caller
 * must `budget.release(job.sizeBytes)` and `queue.ack(job)` when the file is
 * done.
 */
export async function takeNext(queue: TicFileQueue, budget: StorageBudget = storageBudget): Promise<IntakeResult> {
  const job = await queue.take();
  if (!job) return { status: "empty" };

  const result = budget.reserve(job.sizeBytes);
  if (result === "ok") return { status: "taken", job };
  if (result === "no_room") {
    await queue.nack(job);
    return { status: "no_room", job };
  }
  await queue.ack(job); // not requeued: this node will never take it
  return { status: "too_large", job };
}

/** Keep taking jobs while there is room. Stops at the first no_room/empty. */
export async function takeWhileRoom(queue: TicFileQueue, budget: StorageBudget = storageBudget): Promise<FileJob[]> {
  const taken: FileJob[] = [];
  for (;;) {
    const r = await takeNext(queue, budget);
    if (r.status === "taken") taken.push(r.job);
    else if (r.status === "too_large") continue;
    else break;
  }
  return taken;
}
