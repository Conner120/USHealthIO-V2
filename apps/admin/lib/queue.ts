"use server";
/**
 * Admin → Redis queues. No database rows for now; jobs go straight to
 * @repo/queue and the status page reads them back.
 */
import { withAuth } from "@workos-inc/authkit-nextjs";
import { enqueueTask, getQueueStatus, type QueueStatus, type Task } from "@repo/queue";

/** Hardcoded UHC discovery for testing: scans the UHC listing page for index files. */
export async function triggerUhcScan(entityFilter?: string): Promise<Task<"index-scan">> {
  await withAuth({ ensureSignedIn: true });
  return enqueueTask("index-scan", {
    carrier: "uhc",
    type: "uhc-index-page",
    entityFilter: entityFilter || undefined,
  });
}

/** Scan one UHC index JSON directly (skips the listing page). */
export async function triggerUhcToc(url: string): Promise<Task<"index-scan">> {
  await withAuth({ ensureSignedIn: true });
  return enqueueTask("index-scan", { carrier: "uhc", type: "uhc-toc", url });
}

export async function fetchQueueStatus(): Promise<QueueStatus> {
  await withAuth({ ensureSignedIn: true });
  return getQueueStatus(5);
}
