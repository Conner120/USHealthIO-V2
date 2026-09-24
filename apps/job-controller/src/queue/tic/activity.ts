/**
 * In-process record of what this node's file jobs are doing, so the dashboard can show progress
 * per step rather than just "running". The worker calls `begin` / `step` / `progress` / `end`;
 * nothing here affects queue behaviour.
 */
import type { JobActivity } from "@repo/queue";
import type { FileJob } from "./file-queue";
import { fileNameFor } from "./stage";

type Step = JobActivity["step"];

interface Entry extends JobActivity {}

const entries = new Map<string, Entry>();

/** Files/tasks finished since this process started. */
export const totals = { files: 0, failedFiles: 0, tasks: 0, failedTasks: 0 };

export function begin(job: FileJob, stagingBytes: number): void {
  const now = new Date().toISOString();
  entries.set(job.id, {
    id: job.id,
    url: job.url,
    name: fileNameFor(job.url),
    tier: job.tier,
    sizeBytes: job.sizeBytes,
    downloadBytes: null,
    jsonBytes: null,
    stagingBytes,
    step: "downloading",
    stepProgress: 0,
    bytesDone: 0,
    startedAt: now,
    stepStartedAt: now,
  });
}

export function step(jobId: string, step: Step, detail?: string): void {
  const e = entries.get(jobId);
  if (!e) return;
  e.step = step;
  e.stepProgress = step === "downloading" ? 0 : null;
  e.stepStartedAt = new Date().toISOString();
  if (detail !== undefined) e.detail = detail;
}

/** Download progress: `total` is the Content-Length when the server sent one. */
export function progress(jobId: string, bytesDone: number, total?: number): void {
  const e = entries.get(jobId);
  if (!e) return;
  e.bytesDone = bytesDone;
  const denominator = total ?? e.sizeBytes;
  e.stepProgress = denominator > 0 ? Math.min(1, bytesDone / denominator) : null;
}

/**
 * Real sizes, known once the file is on disk: what was downloaded and what the parser will mmap.
 * Until this is called the UI shows `stagingBytes` (the 15x guess) as an estimate.
 */
export function staged(jobId: string, downloadBytes: number, jsonBytes: number): void {
  const e = entries.get(jobId);
  if (!e) return;
  e.downloadBytes = downloadBytes;
  e.jsonBytes = jsonBytes;
  e.bytesDone = downloadBytes;
}

/** Latest parser line, shown while a job is in the parsing step. */
export function detail(jobId: string, line: string): void {
  const e = entries.get(jobId);
  if (e) e.detail = line;
}

export function end(jobId: string, failed: boolean): void {
  entries.delete(jobId);
  totals.files++;
  if (failed) totals.failedFiles++;
}

export function snapshot(): JobActivity[] {
  return [...entries.values()].sort((a, b) => a.startedAt.localeCompare(b.startedAt));
}

/** Test seam. */
export function reset(): void {
  entries.clear();
  totals.files = 0;
  totals.failedFiles = 0;
  totals.tasks = 0;
  totals.failedTasks = 0;
}
