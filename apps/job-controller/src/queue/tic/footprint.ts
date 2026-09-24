/**
 * How much staging space one job actually needs.
 *
 * `FileJob.sizeBytes` is what the carrier's HEAD reported — for MRF files that is almost always
 * the *compressed* size (`.json.gz`). The parser mmaps plain JSON, so the node has to hold the
 * decompressed file, which for these files runs 10-20x the download. We budget a fixed multiple
 * of the compressed size, picked from the URL's extension, and reserve that up front: reserving
 * only the compressed size would let a node accept ten 1 GB downloads and then run out of disk
 * halfway through decompressing the first one.
 *
 *   .json                 1x   (already plain; nothing to expand)
 *   .gz .zip .zst .bz2    15x  (COMPRESSED_EXPANSION_RATIO)
 *   anything else         15x  (assume compressed — the safe direction)
 *
 * The multiplier is deliberately generous; `du` of the staged file is what the budget is
 * corrected to once the file is on disk (see `processJob`).
 */
import { config } from "../../config";
import type { FileJob } from "./file-queue";

/** Extensions we know are already decompressed. */
const PLAIN_EXTENSIONS = [".json", ".ndjson", ".jsonl", ".txt", ".csv"];

/** Extensions we know are compressed (documentation; anything unknown is treated as compressed). */
export const COMPRESSED_EXTENSIONS = [".gz", ".gzip", ".zip", ".zst", ".zstd", ".bz2", ".br", ".xz"];

/** Strips query/fragment and lowercases, so `…/f.json.gz?sig=…` still reads as `.gz`. */
export function pathOf(url: string): string {
  const noQuery = url.split(/[?#]/, 1)[0] ?? url;
  return noQuery.toLowerCase();
}

export function isCompressed(url: string): boolean {
  const path = pathOf(url);
  return !PLAIN_EXTENSIONS.some((ext) => path.endsWith(ext));
}

/**
 * Bytes to reserve for `job`: the download plus room for the decompressed file.
 * Plain files are reserved at their own size.
 */
export function stagingBytesFor(job: Pick<FileJob, "url" | "sizeBytes">, ratio = config.storage.expansionRatio): number {
  return isCompressed(job.url) ? Math.ceil(job.sizeBytes * ratio) : job.sizeBytes;
}

export function formatBytes(n: number): string {
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)} GB`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)} MB`;
  return `${(n / 1e3).toFixed(0)} KB`;
}
