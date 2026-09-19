import { config } from "../../config";

export type ReserveResult = "ok" | "too_large" | "no_room";

/**
 * Tracks staging space on this node (RAM disk or disk, per RAM_NODE).
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
}

export const storageBudget = new StorageBudget();
