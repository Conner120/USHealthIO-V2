/**
 * Step 3 — run parser-rs over a staged file.
 *
 *   parser-rs/target/release/main <file.json> in_network_rates <job_id>
 *
 * The job id becomes `insurance_scan_job_id` on every row the parser writes, so it must be the
 * FileJob id (that is what `mrf_file_plans.file_job_id` points at). `FILE_URL` is passed so the
 * parser can record `mrf_files.file_url`. Sink/ClickHouse settings come from this process's env
 * (PARSER_ENV_PASSTHROUGH), so one `.env` configures both services.
 */
import { config } from "../../config";

export interface ParserResult {
  exitCode: number;
  /** Last lines of parser output, kept for the job log. */
  tail: string;
}

export class ParserFailed extends Error {
  constructor(readonly result: ParserResult) {
    super(`parser exited ${result.exitCode}: ${result.tail.slice(-500)}`);
    this.name = "ParserFailed";
  }
}

function parserEnv(fileUrl: string): Record<string, string> {
  const env: Record<string, string> = { FILE_URL: fileUrl };
  for (const key of config.parser.passThroughEnv) {
    const v = process.env[key];
    if (v !== undefined) env[key] = v;
  }
  return env;
}

/**
 * Parser processes running right now. A parser is a separate OS process that keeps running (and
 * keeps writing to ClickHouse) after this node exits, so shutdown has to kill them explicitly.
 */
const running = new Set<Bun.Subprocess>();

export function runningParsers(): number {
  return running.size;
}

/** Signal every running parser. Used by the shutdown path; returns how many were signalled. */
export function killRunningParsers(signal: NodeJS.Signals = "SIGTERM"): number {
  const n = running.size;
  for (const proc of running) {
    try {
      proc.kill(signal);
    } catch {
      // already gone
    }
  }
  return n;
}

/** Runs the parser to completion, streaming its output into this process's log. */
export async function runParser(
  filePath: string,
  jobId: string,
  fileUrl: string,
  onLine?: (line: string) => void,
): Promise<ParserResult> {
  const proc = Bun.spawn([config.parser.bin, filePath, "in_network_rates", jobId], {
    env: { ...process.env, ...parserEnv(fileUrl) },
    stdout: "pipe",
    stderr: "pipe",
  });
  running.add(proc);

  const lines: string[] = [];
  const pump = async (stream: ReadableStream<Uint8Array>, prefix: string) => {
    const text = await new Response(stream).text();
    for (const line of text.split("\n")) {
      if (!line.trim()) continue;
      console.log(`${prefix} ${line}`);
      onLine?.(line);
      lines.push(line);
      if (lines.length > 50) lines.shift();
    }
  };
  await Promise.all([pump(proc.stdout, `[parser ${jobId}]`), pump(proc.stderr, `[parser ${jobId}!]`)]);

  const exitCode = await proc.exited;
  running.delete(proc);
  const result = { exitCode, tail: lines.join("\n") };
  if (exitCode !== 0) throw new ParserFailed(result);
  return result;
}
