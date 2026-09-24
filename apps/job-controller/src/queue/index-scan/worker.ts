import { enqueueFile, enqueueTasksDeduped, withUrlClaim, type IndexScanPayload } from "@repo/queue";
import type { Task } from "../management/task";
import { runIndexScan } from "./index";
import type { DiscoveredFile } from "./types";
import * as runlog from "../../lib/runlog";
import { FilePlanBatch, fileJobIdFor, rememberFileJob } from "./file-plans";

export type IndexScanTask = Task<"index-scan">;

/**
 * Index-scan worker. Runs on management nodes via processTask("index-scan").
 *
 *   payload ── runIndexScan ──▶ DiscoveredFile[]
 *     table-of-contents files ──▶ follow-up index-scan task (same carrier)
 *     everything else         ──▶ FileJob on the tier queue for its size
 *
 * Every URL goes through withUrlClaim (@repo/queue dedupe) first, so a file
 * referenced by many TOCs is evaluated and enqueued exactly once across all
 * tasks and nodes *within one scan job*: dedupe is segmented by the scan job
 * id that started the tree (task.scanJobId, or the root task's id when none
 * was given), which every follow-up task inherits. The plans each TOC
 * lists for the file are recorded on every reference, duplicate or not
 * (file-plans.ts), so a shared file stays linked to all of its plans.
 */
export async function processIndexScan(task: IndexScanTask): Promise<IndexScanResult> {
  // Top-level job id: set on the root task and inherited by every follow-up.
  // A root task sent without one uses its own id as the top-level id.
  const scanJobId = task.scanJobId ?? task.id;
  const found = await runIndexScan(task.payload);
  const result: IndexScanResult = { followUps: 0, enqueued: 0, skipped: 0, duplicates: 0, planLinks: 0 };
  const plans = new FilePlanBatch();

  // Follow-up TOC scans fan out in bulk: one Redis round-trip per 500 rather
  // than a claim + enqueue per TOC, so with 67k TOCs the workers can start
  // taking follow-ups seconds into this task instead of minutes.
  const tocs = found.filter((f) => f.fileType === "table-of-contents");
  if (tocs.length) {
    const r = await enqueueTasksDeduped(
      scanJobId,
      "index-scan",
      tocs.map((f) => ({ url: f.url, payload: followUpPayload(task.payload, f) })),
    );
    result.followUps += r.enqueued;
    result.duplicates += r.duplicates;
    runlog.append(task.id, `fanned out ${r.enqueued} follow-up scans (${r.duplicates} already seen)`);
  }

  for (const f of found) {
    if (f.fileType === "table-of-contents") continue;
    const r = await withUrlClaim(scanJobId, f.url, async () => {
      const sizeBytes = f.sizeBytes ?? (await headContentLength(f.url));
      if (sizeBytes == null) {
        console.warn(`[index-scan] no size for ${f.url}, skipping`);
        return "skipped" as const;
      }
      const job = await enqueueFile({ url: f.url, sizeBytes, discoveredAt: f.foundAt, scanJobId });
      await rememberFileJob(scanJobId, f.url, job.id);
      return "enqueued" as const;
    });

    if (r.status !== "claimed") result.duplicates++;
    else if (r.value === "skipped") result.skipped++;
    else result.enqueued++;

    // Link this reference's plans to the file whether or not we queued it.
    if (f.plans?.length) {
      plans.add(f, await fileJobIdFor(scanJobId, f.url));
    }
  }

  result.planLinks = await plans.flush();
  console.log(`[index-scan] ${task.payload.type} ${task.id} (scan job ${scanJobId}):`, result);
  runlog.append(task.id, `${task.payload.type} done: ${JSON.stringify(result)}`);
  return result;
}

export interface IndexScanResult {
  followUps: number;
  enqueued: number;
  skipped: number;
  /** URLs already evaluated (or being evaluated) by another job. */
  duplicates: number;
  /** (file, plan) rows written to ClickHouse mrf_file_plans. */
  planLinks: number;
}

/** A discovered TOC becomes another index-scan for the same carrier. */
function followUpPayload(parent: IndexScanPayload, f: DiscoveredFile): IndexScanPayload {
  switch (parent.carrier) {
    case "uhc":
      return { carrier: "uhc", type: "uhc-toc", url: f.url, reportingEntity: f.reportingEntity };
  }
}

async function headContentLength(url: string): Promise<number | null> {
  try {
    const res = await fetch(url, { method: "HEAD", redirect: "follow" });
    const len = res.headers.get("content-length");
    return res.ok && len ? Number(len) : null;
  } catch {
    return null;
  }
}
