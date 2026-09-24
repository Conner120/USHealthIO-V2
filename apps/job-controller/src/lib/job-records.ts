/**
 * Reports every operation this node runs to ClickHouse `health.job_runs`.
 *
 * A row is written when a job starts, on each step transition and when it ends; the table is a
 * ReplacingMergeTree keyed by run_id, so `SELECT ... FINAL` is the current status of every job
 * across every node. The final write carries the operation's console output, which is what makes
 * the record outlive the local log directory (cleared on the next boot).
 *
 * Reporting is best-effort and never blocks or fails a job: a ClickHouse hiccup costs a warning,
 * not the work. Writes are queued and flushed on an interval so a burst of step transitions is
 * one INSERT rather than dozens.
 *
 *   JOB_RECORDS_ENABLED   default true
 *   JOB_LOG_MAX_BYTES     how much console output to keep per record (default 256 KiB, tail)
 *   JOB_RECORDS_FLUSH_MS  batching window (default 2000)
 */
import { clickhouse } from "../clients/clickhouse";
import { config } from "../config";
import { nodeId } from "@repo/queue";
import * as runlog from "./runlog";

export interface JobRunRow {
  run_id: string;
  kind: "file" | "task";
  node_id: string;
  scan_job_id: string;
  label: string;
  url: string;
  tier: string;
  status: runlog.RunStatus;
  step: string;
  attempts: number;
  size_bytes: number;
  download_bytes: number;
  json_bytes: number;
  staging_bytes: number;
  started_at: string;
  updated_at: string;
  ended_at: string | null;
  duration_ms: number;
  error: string;
  log_lines: number;
  log: string;
}

/** What callers supply; everything else is filled in here. */
export interface ReportInput {
  id: string;
  kind: "file" | "task";
  label: string;
  scanJobId?: string;
  url?: string;
  tier?: string;
  status: runlog.RunStatus;
  step?: string;
  attempts?: number;
  sizeBytes?: number;
  downloadBytes?: number;
  jsonBytes?: number;
  stagingBytes?: number;
  startedAt: Date;
  endedAt?: Date;
  error?: unknown;
  /** Include the console output (done on the final write). */
  withLog?: boolean;
}

/** ClickHouse DateTime64(3) wants `YYYY-MM-DD HH:MM:SS.mmm`. */
export function chTime(d: Date): string {
  return d.toISOString().replace("T", " ").replace("Z", "");
}

export function errorText(e: unknown): string {
  if (e === undefined || e === null) return "";
  if (e instanceof Error) return (e.stack ?? e.message).slice(0, 8192);
  return String(e).slice(0, 8192);
}

/** Keeps the tail: the end of a log says why a job failed, the start rarely does. */
export function truncateLog(text: string, maxBytes: number): string {
  if (maxBytes <= 0) return "";
  const bytes = Buffer.byteLength(text, "utf8");
  if (bytes <= maxBytes) return text;
  const tail = Buffer.from(text, "utf8").subarray(bytes - maxBytes).toString("utf8");
  // The cut may land mid-line (and mid-codepoint, which toString has already replaced).
  const nl = tail.indexOf("\n");
  const clean = nl >= 0 ? tail.slice(nl + 1) : tail;
  return `[… ${bytes - Buffer.byteLength(clean, "utf8")} earlier bytes omitted …]\n${clean}`;
}

export function buildRow(input: ReportInput, now = new Date()): JobRunRow {
  const log = input.withLog
    ? truncateLog(
        runlog.lines(input.id).map((l) => `${l.at} ${l.text}`).join("\n"),
        config.jobRecords.logMaxBytes,
      )
    : "";
  return {
    run_id: input.id,
    kind: input.kind,
    node_id: nodeId,
    scan_job_id: input.scanJobId ?? "",
    label: input.label,
    url: input.url ?? "",
    tier: input.tier ?? "",
    status: input.status,
    step: input.step ?? "",
    attempts: input.attempts ?? 0,
    size_bytes: input.sizeBytes ?? 0,
    download_bytes: input.downloadBytes ?? 0,
    json_bytes: input.jsonBytes ?? 0,
    staging_bytes: input.stagingBytes ?? 0,
    started_at: chTime(input.startedAt),
    updated_at: chTime(now),
    ended_at: input.endedAt ? chTime(input.endedAt) : null,
    duration_ms: input.endedAt ? input.endedAt.getTime() - input.startedAt.getTime() : now.getTime() - input.startedAt.getTime(),
    error: errorText(input.error),
    log_lines: runlog.summary(input.id)?.lines ?? 0,
    log,
  };
}

// ── Queue + flush ──────────────────────────────────────────────────────────

let pending: JobRunRow[] = [];
let timer: ReturnType<typeof setInterval> | null = null;

/** Queue a row. Returns immediately; the insert happens on the next flush. */
export function report(input: ReportInput): void {
  if (!config.jobRecords.enabled) return;
  pending.push(buildRow(input));
  // A final row (job ended) is worth sending promptly so the record is durable.
  if (input.status !== "running") void flush();
}

export async function flush(): Promise<number> {
  if (pending.length === 0) return 0;
  const batch = pending;
  pending = [];
  try {
    await clickhouse.insert({ table: config.jobRecords.table, values: batch, format: "JSONEachRow" });
    return batch.length;
  } catch (e) {
    // Reporting must never fail a job. Drop the batch rather than growing unbounded; the
    // dashboard and the local log files still have the same information.
    console.warn(`[job-records] dropped ${batch.length} record(s): ${errorText(e).split("\n")[0]}`);
    return 0;
  }
}

export function start(): void {
  if (timer || !config.jobRecords.enabled) return;
  timer = setInterval(() => void flush(), config.jobRecords.flushMs);
  timer.unref?.();
}

export async function stop(): Promise<void> {
  if (timer) clearInterval(timer);
  timer = null;
  await flush();
}

/** Test seam. */
export function pendingCount(): number {
  return pending.length;
}
export function reset(): void {
  pending = [];
  if (timer) clearInterval(timer);
  timer = null;
}
