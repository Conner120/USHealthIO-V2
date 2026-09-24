import { finishFile } from "@repo/queue";
import { config } from "../../config";
import type { FileJob, TicFileQueue } from "./file-queue";
import { formatBytes, stagingBytesFor } from "./footprint";
import { takeNext } from "./intake";
import * as records from "../../lib/job-records";
import * as runlog from "../../lib/runlog";
import * as activity from "./activity";
import { runParser } from "./parser";
import { cleanup, fileNameFor, jobDir, stage } from "./stage";
import { storageBudget, type StorageBudget } from "./storage-budget";

/**
 * Do the work for one job, in four steps:
 *
 *   1. download    url -> <STAGING_DIR>/<job id>/<name>         (streamed)
 *   2. decompress  .gz/.zip/.zst/.bz2 -> plain .json            (skipped for plain files)
 *   3. parse       parser-rs <file.json> in_network_rates <job id>
 *   4. cleanup     rm -rf <STAGING_DIR>/<job id>
 *
 * Space for all of this was reserved before the job started, at 15x the compressed size
 * (footprint.ts). Once the file is staged we know the real size, so the reservation is corrected
 * up or down before the parse — a file that expanded more than 15x holds its true size for the
 * rest of the run rather than silently overcommitting the node.
 *
 * `startJob` releases the reservation and acks the job when this returns or throws. Until then
 * the job sits in `{queue}:inflight` under this node; if the process dies the reaper hands it to
 * another node, and step 4 of the dead instance never ran — see `sweepStagingDir`.
 */
export async function processJob(job: FileJob, budget: StorageBudget = storageBudget): Promise<void> {
  const reserved = stagingBytesFor(job);
  const started = Date.now();
  const startedAt = new Date(started);
  activity.begin(job, reserved);
  // Shared by every record this job writes; sizes are filled in as they become known.
  const base = {
    id: job.id,
    kind: "file" as const,
    label: fileNameFor(job.url),
    scanJobId: job.scanJobId,
    url: job.url,
    tier: job.tier,
    attempts: job.attempts ?? 0,
    sizeBytes: job.sizeBytes,
    stagingBytes: reserved,
    startedAt,
  };
  let sizes: { downloadBytes?: number; jsonBytes?: number } = {};
  let reported = false;
  records.report({ ...base, status: "running", step: "downloading" });
  // Everything this job prints also goes to its own log, so the dashboard can expand it later.
  const log = (line: string) => {
    console.log(line);
    runlog.append(job.id, line);
  };
  log(`[1/4] download ${job.url}`);
  try {
    // 1 + 2
    const staged = await stage(job.url, job.id, {
      onProgress: (done, total) => activity.progress(job.id, done, total),
      onDecompressStart: () => activity.step(job.id, "decompressing"),
    });
    log(
      `[2/4] staged ${formatBytes(staged.downloadBytes)} -> ${formatBytes(staged.jsonBytes)} ` +
        `(${(staged.jsonBytes / Math.max(staged.downloadBytes, 1)).toFixed(1)}x, reserved ${formatBytes(reserved)}) ${staged.path}`,
    );
    // Correct the guess with what is actually on disk (peak = both copies during decompression).
    activity.staged(job.id, staged.downloadBytes, staged.jsonBytes);
    sizes = { downloadBytes: staged.downloadBytes, jsonBytes: staged.jsonBytes };
    budget.adjustJob(job, Math.max(staged.peakBytes, staged.jsonBytes));

    // 3
    activity.step(job.id, "parsing");
    records.report({ ...base, ...sizes, status: "running", step: "parsing" });
    log(`[3/4] parse ${staged.path}`);
    await runParser(staged.path, job.id, job.url, (line) => {
      activity.detail(job.id, line);
      runlog.append(job.id, line);
    });
    log(`[3/4] parsed in ${((Date.now() - started) / 1000).toFixed(1)}s`);
  } catch (err) {
    // The record is written here, while the error is in hand; the caller only sees it thrown.
    records.report({ ...base, ...sizes, status: "failed", step: "cleaning", endedAt: new Date(), error: err, withLog: true });
    reported = true;
    throw err;
  } finally {
    // 4 — always, including on failure: a half-staged file is dead weight.
    activity.step(job.id, "cleaning");
    log(`[4/4] cleanup ${jobDir(job.id)}`);
    await cleanup(job.id).catch((e) => {
      const msg = `[4/4] cleanup ${jobDir(job.id)} failed: ${e}`;
      console.error(msg);
      runlog.append(job.id, msg);
    });
    // Final record, with the console output attached so it outlives the local log dir.
    if (!reported) {
      records.report({ ...base, ...sizes, status: "done", step: "", endedAt: new Date(), withLog: true });
    }
  }
}

/** Jobs currently running on this node. */
export const inFlight = new Map<string, Promise<void>>();

// Wakes the poll loop as soon as a job finishes, so a freed slot is refilled immediately.
let wake: (() => void) | null = null;
function slotFreed(): void {
  wake?.();
  wake = null;
}

/** Wake the poll loop now (shutdown), so it does not sit out the poll interval. */
export function wakeNow(): void {
  slotFreed();
}

/** Resolves when a file job finishes or after `ms`, whichever comes first. */
export function waitForSlotOrTimeout(ms: number): Promise<void> {
  return new Promise((resolve) => {
    const t = setTimeout(() => { wake = null; resolve(); }, ms);
    wake = () => { clearTimeout(t); resolve(); };
  });
}

/** Launch a job in the background. Never awaited by the poll loop. */
export function startJob(job: FileJob, queue: TicFileQueue): void {
  let failed = false;
  runlog.begin(job.id, "file", fileNameFor(job.url));
  console.log(`[worker] job ${job.id} (${queue.tier}) starting — ${formatBytes(job.sizeBytes)} compressed, ${inFlight.size + 1}/${config.files.maxConcurrent} slots`);
  const run = processJob(job)
    .catch((err) => {
      failed = true;
      console.error(`[worker] job ${job.id} (${queue.tier}) failed:`, err);
      runlog.append(job.id, `FAILED: ${err instanceof Error ? (err.stack ?? err.message) : err}`);
    })
    .finally(async () => {
      storageBudget.releaseJob(job);
      inFlight.delete(job.id);
      await queue.ack(job);
      activity.end(job.id, failed);
      runlog.end(job.id, failed);
      if (await finishFile(job.url, { failed })) console.log("[worker] all work done — ledger and seen-URL set cleared");
      slotFreed();
    });
  inFlight.set(job.id, run);
}

/** True while this node has room for another file job. */
export function hasFreeSlot(): boolean {
  return inFlight.size < config.files.maxConcurrent;
}

/**
 * One poll tick for one tier: keep taking jobs while they fit and start each one independently.
 * Stops at MAX_CONCURRENT_FILES, at the first job that doesn't fit (it's sent back), or when the
 * tier is empty. As running jobs finish they release space and a slot, so the next tick picks up
 * more.
 */
export async function pollQueue(queue: TicFileQueue): Promise<number> {
  let started = 0;
  while (hasFreeSlot()) {
    const r = await takeNext(queue);
    if (r.status === "taken") {
      startJob(r.job, queue);
      started++;
    } else if (r.status === "too_large") {
      console.warn(
        `[worker] job ${r.job.id} needs ${formatBytes(stagingBytesFor(r.job))} staged ` +
          `(${formatBytes(r.job.sizeBytes)} compressed) — over MAX_FILE_BYTES, skipping`,
      );
      await finishFile(r.job.url, { failed: true });
    } else {
      return started; // no_room or empty
    }
  }
  return started; // at MAX_CONCURRENT_FILES
}

/** Wait for every running job to finish (graceful shutdown). */
export async function drain(): Promise<void> {
  await Promise.allSettled([...inFlight.values()]);
}
