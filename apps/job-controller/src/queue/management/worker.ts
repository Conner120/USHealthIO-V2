import { config } from "../../config";
import { finishTask } from "@repo/queue";
import type { ManagementQueue, Task } from "./task";
import { processIndexScan, type IndexScanTask } from "../index-scan";

/**
 * Do the work for one task. Dispatch on `task.kind`. Throw to fail; the poll
 * loop requeues it until MAX_TASK_ATTEMPTS.
 */
export async function processTask(task: Task): Promise<void> {
  switch (task.kind) {
    case "index-scan":
      await processIndexScan(task as IndexScanTask);
      return;
    case "discovery":
    case "cleanup":
      throw new Error(`processTask not implemented (${task.kind}/${task.id})`);
  }
}

/** Tasks currently running on this node. */
export const inFlight = new Map<string, Promise<void>>();

// Wakes the poll loop as soon as a task finishes, so a freed slot is refilled
// immediately instead of on the next POLL_INTERVAL_MS tick.
let wake: (() => void) | null = null;
function slotFreed(): void {
  wake?.();
  wake = null;
}

/** Resolves when a task finishes or after `ms`, whichever comes first. */
export function waitForSlotOrTimeout(ms: number): Promise<void> {
  return new Promise((resolve) => {
    const t = setTimeout(() => { wake = null; resolve(); }, ms);
    wake = () => { clearTimeout(t); resolve(); };
  });
}

export function hasFreeSlot(): boolean {
  return inFlight.size < config.management.maxConcurrentTasks;
}

/** Launch a task in the background. Never awaited by the poll loop. */
export function startTask(task: Task, queue: ManagementQueue): void {
  const run = processTask(task)
    .catch(async (err) => {
      console.error(`[mgmt] task ${task.id} (${task.kind}) failed:`, err);
      if (task.attempts + 1 < config.management.maxTaskAttempts) {
        await queue.push({ ...task, attempts: task.attempts + 1 });
      } else {
        console.error(`[mgmt] task ${task.id} gave up after ${config.management.maxTaskAttempts} attempts`);
      }
    })
    .finally(async () => {
      inFlight.delete(task.id);
      await queue.ack(task);
      if (await finishTask()) console.log("[mgmt] all work done — ledger and seen-URL set cleared");
      slotFreed();
    });
  inFlight.set(task.id, run);
}

/**
 * One poll tick for one queue: start tasks until MAX_CONCURRENT_TASKS are
 * running or the queue is empty.
 */
export async function pollTaskQueue(queue: ManagementQueue): Promise<number> {
  let started = 0;
  while (inFlight.size < config.management.maxConcurrentTasks) {
    const task = await queue.take();
    if (!task) break;
    startTask(task, queue);
    started++;
  }
  return started;
}

/** Wait for every running task to finish (graceful shutdown). */
export async function drain(): Promise<void> {
  await Promise.allSettled([...inFlight.values()]);
}
