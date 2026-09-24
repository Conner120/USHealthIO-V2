/**
 * Per-operation console output, kept for the dashboard.
 *
 * Every file job and management task gets a log: lines are held in memory (for the live view) and
 * appended to `<LOG_DIR>/<id>.log` so the output of an operation that has already finished can
 * still be opened. Both the in-memory index and the directory cover one run of this node —
 * `sweep()` clears the directory at startup, so "history" means "since this node booted".
 *
 *   LOG_DIR            default <cwd>/tmp/job-logs   (the project's tmp dir)
 *   LOG_KEEP_LINES     lines kept in memory per operation (default 500)
 *   LOG_KEEP_RUNS      finished operations kept in the index (default 200)
 *
 * Writes are fire-and-forget: a log failing must never fail the job it is describing.
 */
import { appendFile, mkdir, readdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { config } from "../config";

export type RunKind = "file" | "task";
export type RunStatus = "running" | "done" | "failed";

export interface RunLine {
  /** Monotonic per-run sequence, so the UI can ask for "everything after n". */
  n: number;
  at: string;
  text: string;
}

export interface RunSummary {
  id: string;
  kind: RunKind;
  /** Short label: file name, or task kind. */
  label: string;
  status: RunStatus;
  startedAt: string;
  endedAt?: string;
  lines: number;
}

interface Run extends RunSummary {
  buffer: RunLine[];
  seq: number;
}

const runs = new Map<string, Run>();

/**
 * Resolved per call rather than captured at import: `config` is built once at module load, which
 * is too early for anything that sets LOG_DIR later (tests, a wrapper script).
 */
export function logDir(): string {
  return process.env.LOG_DIR?.trim() || config.log.dir;
}

function fileFor(id: string): string {
  // Ids are uuids / task ids. Dots are dropped along with separators so no id can produce a
  // traversal-looking name; the result is always a plain file inside the log dir.
  return join(logDir(), `${id.replace(/[^A-Za-z0-9_-]/g, "_")}.log`);
}

let ready: Promise<void> | null = null;
function ensureDir(): Promise<void> {
  ready ??= mkdir(logDir(), { recursive: true }).then(() => undefined);
  return ready;
}

/** Drop finished runs beyond LOG_KEEP_RUNS, oldest first. Their files stay until the next sweep. */
function trimIndex(): void {
  const finished = [...runs.values()].filter((r) => r.status !== "running");
  const excess = finished.length - config.log.keepRuns;
  if (excess <= 0) return;
  finished
    .sort((a, b) => (a.endedAt ?? a.startedAt).localeCompare(b.endedAt ?? b.startedAt))
    .slice(0, excess)
    .forEach((r) => runs.delete(r.id));
}

export function begin(id: string, kind: RunKind, label: string): void {
  runs.set(id, {
    id,
    kind,
    label,
    status: "running",
    startedAt: new Date().toISOString(),
    lines: 0,
    buffer: [],
    seq: 0,
  });
  void ensureDir();
}

/** Record one console line. Safe to call for an unknown id (creates a minimal run). */
export function append(id: string, text: string): void {
  let run = runs.get(id);
  if (!run) {
    begin(id, "task", id);
    run = runs.get(id)!;
  }
  const line: RunLine = { n: ++run.seq, at: new Date().toISOString(), text };
  run.lines++;
  run.buffer.push(line);
  if (run.buffer.length > config.log.keepLines) run.buffer.shift();

  void ensureDir()
    .then(() => appendFile(fileFor(id), `${line.at} ${text}\n`))
    .catch(() => {
      /* a log write must never break the job */
    });
}

export function end(id: string, failed: boolean): void {
  const run = runs.get(id);
  if (!run) return;
  run.status = failed ? "failed" : "done";
  run.endedAt = new Date().toISOString();
  trimIndex();
}

/** Lines after `since` (0 = from the start of what is still in memory). */
export function lines(id: string, since = 0): RunLine[] {
  const run = runs.get(id);
  if (!run) return [];
  return since > 0 ? run.buffer.filter((l) => l.n > since) : [...run.buffer];
}

export function summary(id: string): RunSummary | null {
  const run = runs.get(id);
  if (!run) return null;
  const { buffer: _buffer, seq: _seq, ...rest } = run;
  return rest;
}

/** Newest first: running operations, then finished ones. */
export function list(): RunSummary[] {
  return [...runs.values()]
    .map(({ buffer: _b, seq: _s, ...rest }) => rest)
    .sort((a, b) => {
      if (a.status === "running" && b.status !== "running") return -1;
      if (b.status === "running" && a.status !== "running") return 1;
      return (b.endedAt ?? b.startedAt).localeCompare(a.endedAt ?? a.startedAt);
    });
}

/**
 * Clear the log directory. Called once at startup: the in-memory index is empty at that point, so
 * anything on disk is from a previous boot.
 */
export async function sweep(): Promise<number> {
  const dir = logDir();
  let removed = 0;
  try {
    for (const entry of await readdir(dir)) {
      if (!entry.endsWith(".log")) continue;
      await rm(join(dir, entry), { force: true });
      removed++;
    }
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
  }
  if (removed > 0) console.log(`[runlog] cleared ${removed} log file(s) from a previous boot in ${dir}`);
  return removed;
}

/** Test seam. */
export function reset(): void {
  runs.clear();
  ready = null;
}
