/**
 * Staging: get a queued URL onto local disk as plain JSON the parser can mmap.
 *
 *   download(url) -> <stagingDir>/<jobId>/<name>        (streamed, never held in memory)
 *   decompress()  -> <stagingDir>/<jobId>/<name>.json   (gunzip/unzip/zstd/bunzip2 by extension)
 *
 * Both steps report the bytes they produced so the caller can correct the budget: the 15x
 * reservation (footprint.ts) is a guess, the staged size is the truth.
 */
import { mkdir, readdir, rm, stat } from "node:fs/promises";
import { join } from "node:path";
import { config } from "../../config";
import { isCompressed, pathOf } from "./footprint";

/** Callbacks for reporting step transitions and download progress (see tic/activity.ts). */
export interface StageHooks {
  onProgress?: ProgressFn;
  onDecompressStart?: () => void;
}

export interface StagedFile {
  /** Plain-JSON path handed to the parser. */
  path: string;
  /** Bytes the download occupied. */
  downloadBytes: number;
  /** Bytes the parser will mmap (== downloadBytes when the file was not compressed). */
  jsonBytes: number;
  /** Peak bytes on disk during the job (both copies exist while decompressing). */
  peakBytes: number;
}

export function jobDir(jobId: string): string {
  return join(config.storage.stagingDir, jobId);
}

/** `…/2026-09-01_X_in-network-rates.json.gz?sig=…` -> `2026-09-01_X_in-network-rates.json.gz` */
export function fileNameFor(url: string): string {
  const path = pathOf(url);
  const name = path.split("/").pop() ?? "mrf";
  return name.length > 0 ? name : "mrf";
}

async function sizeOf(path: string): Promise<number> {
  return (await stat(path)).size;
}

/** Called with bytes written so far and the Content-Length when the server sent one. */
export type ProgressFn = (bytesDone: number, totalBytes?: number) => void;

/**
 * Step 1 — stream the URL to disk. Follows redirects (UHC 302s to blob storage). The body is
 * written chunk by chunk rather than with `Bun.write(dest, res)` so progress can be reported;
 * nothing is buffered in memory either way.
 */
export async function download(url: string, dest: string, onProgress?: ProgressFn): Promise<number> {
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok || !res.body) throw new Error(`download ${url} -> ${res.status} ${res.statusText}`);
  const header = res.headers.get("content-length");
  const total = header ? Number(header) : undefined;

  const sink = Bun.file(dest).writer();
  let done = 0;
  try {
    for await (const chunk of res.body as unknown as AsyncIterable<Uint8Array>) {
      sink.write(chunk);
      done += chunk.byteLength;
      onProgress?.(done, total);
      // Keep memory flat on multi-GB files rather than letting the sink buffer grow.
      if (done % (8 * 1024 * 1024) < chunk.byteLength) await sink.flush();
    }
  } finally {
    await sink.end();
  }
  return sizeOf(dest);
}

/** Decompressor for a staged file, or null when it is already plain JSON. */
function decompressorFor(path: string): { cmd: string[]; out: string } | null {
  const strip = (suffix: string) => path.slice(0, -suffix.length);
  if (path.endsWith(".gz") || path.endsWith(".gzip")) return { cmd: ["gunzip", "-f", path], out: strip(path.endsWith(".gz") ? ".gz" : ".gzip") };
  if (path.endsWith(".zst") || path.endsWith(".zstd")) return { cmd: ["zstd", "-d", "-f", "--rm", path], out: strip(path.endsWith(".zst") ? ".zst" : ".zstd") };
  if (path.endsWith(".bz2")) return { cmd: ["bunzip2", "-f", path], out: strip(".bz2") };
  if (path.endsWith(".xz")) return { cmd: ["unxz", "-f", path], out: strip(".xz") };
  if (path.endsWith(".zip")) return { cmd: ["unzip", "-o", "-q", path, "-d", path.slice(0, path.lastIndexOf("/"))], out: strip(".zip") };
  return null;
}

/** Step 2 — decompress in place. Returns the plain-JSON path and its size. */
export async function decompress(path: string): Promise<{ path: string; bytes: number }> {
  const d = decompressorFor(path);
  if (!d) return { path, bytes: await sizeOf(path) };

  const proc = Bun.spawn(d.cmd, { stdout: "pipe", stderr: "pipe" });
  const code = await proc.exited;
  if (code !== 0) {
    const err = await new Response(proc.stderr).text();
    throw new Error(`${d.cmd[0]} failed (exit ${code}): ${err.trim().slice(0, 300)}`);
  }
  // Some carriers ship `.gz` whose payload is not named `.json`; fall back to whatever landed.
  const out = (await Bun.file(d.out).exists()) ? d.out : path;
  return { path: out, bytes: await sizeOf(out) };
}

/** Steps 1+2 together, into this job's own directory. */
export async function stage(url: string, jobId: string, hooks: StageHooks = {}): Promise<StagedFile> {
  const dir = jobDir(jobId);
  await mkdir(dir, { recursive: true });
  const downloaded = join(dir, fileNameFor(url));

  const downloadBytes = await download(url, downloaded, hooks.onProgress);
  if (!isCompressed(url)) {
    return { path: downloaded, downloadBytes, jsonBytes: downloadBytes, peakBytes: downloadBytes };
  }
  hooks.onDecompressStart?.();
  const { path, bytes } = await decompress(downloaded);
  return { path, downloadBytes, jsonBytes: bytes, peakBytes: downloadBytes + bytes };
}

/**
 * Startup sweep: remove staging directories left by a previous instance (a node that was killed
 * between step 1 and step 4 never ran its own cleanup). Runs before the poll loop, when this node
 * owns no jobs, so anything in STAGING_DIR is by definition orphaned.
 */
export async function sweepStagingDir(): Promise<number> {
  if (config.storage.keepStaged) return 0;
  const dir = config.storage.stagingDir;
  let removed = 0;
  try {
    const entries = await readdir(dir);
    for (const entry of entries) {
      await rm(join(dir, entry), { recursive: true, force: true });
      removed++;
    }
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
  }
  if (removed > 0) console.warn(`[stage] removed ${removed} staging dir(s) left by a previous instance in ${dir}`);
  return removed;
}

/** Step 4 — remove the job's staging directory (unless KEEP_STAGED_FILES). */
export async function cleanup(jobId: string): Promise<void> {
  if (config.storage.keepStaged) return;
  await rm(jobDir(jobId), { recursive: true, force: true });
}
