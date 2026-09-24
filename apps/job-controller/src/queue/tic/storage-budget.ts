import { config } from "../../config";
import type { FileJob } from "./file-queue";
import { stagingBytesFor } from "./footprint";

export type ReserveResult = "ok" | "too_large" | "no_room";

/**
 * Tracks staging space on this node (RAM disk or disk, per RAM_NODE).
 *
 * Everything here is in *staging footprint* bytes — the decompressed size the node must hold,
 * not the download size. Intake reserves `stagingBytesFor(job)` (15x the compressed size for
 * `.gz`; see footprint.ts), the worker corrects it to the real size once the file is staged,
 * and `releaseJob` gives back whatever is currently held for that job.
 *
 * In-process only — if several controllers share one volume, move to Redis.
 */
export class StorageBudget {
  private reserved = 0;

  constructor(
    readonly totalBytes: number = config.storage.totalBytes,
    readonly maxFileBytes: number = config.storage.maxFileBytes,
  ) {}

  get availableBytes(): number {
    return this.totalBytes - this.reserved;
  }

  get reservedBytes(): number {
    return this.reserved;
  }

  /** True if the node could fit a file of this size right now. */
  hasRoom(bytes: number): boolean {
    return bytes <= this.maxFileBytes && bytes <= this.availableBytes;
  }

  /**
   * Reserve space for a file.
   *  - "too_large": exceeds MAX_FILE_BYTES; this node will never take it.
   *  - "no_room":   fits the limit but not the free space; try again later.
   */
  reserve(bytes: number): ReserveResult {
    if (bytes > this.maxFileBytes) return "too_large";
    if (bytes > this.availableBytes) return "no_room";
    this.reserved += bytes;
    return "ok";
  }

  /** Give space back once the file leaves the node. */
  release(bytes: number): void {
    this.reserved = Math.max(0, this.reserved - bytes);
  }

  /**
   * Bytes currently held for `job`: the corrected figure if the worker got that far, otherwise
   * the original reservation. Keeps `reserve` and `releaseJob` in balance.
   */
  private held(job: FileJob): number {
    return this.actualByJob.get(job.id) ?? stagingBytesFor(job);
  }

  private readonly actualByJob = new Map<string, number>();

  /**
   * Correct a job's reservation to its real staged size, once the file is on disk. Never fails:
   * the space is already used, so the node goes over budget rather than pretending it did not.
   * Going over is logged so COMPRESSED_EXPANSION_RATIO can be tuned.
   */
  adjustJob(job: FileJob, actualBytes: number): void {
    const before = this.held(job);
    this.reserved = Math.max(0, this.reserved - before) + actualBytes;
    this.actualByJob.set(job.id, actualBytes);
    if (actualBytes > before) {
      console.warn(
        `[budget] job ${job.id} staged ${actualBytes} bytes, reserved ${before} — over by ${actualBytes - before}; consider raising COMPRESSED_EXPANSION_RATIO`,
      );
    }
  }

  /** Release whatever is held for `job` (corrected size if known, else the reservation). */
  releaseJob(job: FileJob): void {
    this.release(this.held(job));
    this.actualByJob.delete(job.id);
  }
}

export const storageBudget = new StorageBudget();
