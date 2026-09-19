import { finishFile } from "@repo/queue";
import type { FileJob, TicFileQueue } from "./file-queue";
import { takeNext } from "./intake";
import { storageBudget } from "./storage-budget";

/**
 * Do the work for one job: download the MRF to this node's staging area,
 * hand it to the parser, record the result. Space is already reserved;
 * `startJob` releases it and acks the job when this returns or throws. Until
 * then the job sits in `{queue}:inflight` under this node; if the process
 * dies the reaper hands it to another node.
 */
export async function processJob(job: FileJob): Promise<void> {
  // TODO: application code
  throw new Error(`processJob not implemented (${job.id})`);
}

/** Jobs currently running on this node. */
export const inFlight = new Map<string, Promise<void>>();

/** Launch a job in the background. Never awaited by the poll loop. */
export function startJob(job: FileJob, queue: TicFileQueue): void {
  let failed = false;
  const run = processJob(job)
    .catch((err) => {
      failed = true;
      console.error(`[worker] job ${job.id} (${queue.tier}) failed:`, err);
    })
    .finally(async () => {
      storageBudget.release(job.sizeBytes);
      inFlight.delete(job.id);
      await queue.ack(job);
      if (await finishFile(job.url, { failed })) console.log("[worker] all work done — ledger and seen-URL set cleared");
    });
  inFlight.set(job.id, run);
}

/**
 * One poll tick for one tier: keep taking jobs while they fit and start each
 * one independently. Stops at the first job that doesn't fit (it's sent back)
 * or when the tier is empty. As running jobs finish they release space, so the
 * next tick can pick up more.
 */
export async function pollQueue(queue: TicFileQueue): Promise<number> {
  let started = 0;
  for (;;) {
    const r = await takeNext(queue);
    if (r.status === "taken") {
      startJob(r.job, queue);
      started++;
    } else if (r.status === "too_large") {
      console.warn(`[worker] job ${r.job.id} exceeds MAX_FILE_BYTES, skipping`);
      await finishFile(r.job.url, { failed: true });
    } else {
      return started; // no_room or empty
    }
  }
}

/** Wait for every running job to finish (graceful shutdown). */
export async function drain(): Promise<void> {
  await Promise.allSettled([...inFlight.values()]);
}
