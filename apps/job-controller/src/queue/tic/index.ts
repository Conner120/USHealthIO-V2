import type { SizeTier } from "@repo/queue";
import { TicFileQueue } from "./file-queue";

export * from "./file-queue";
export * from "./storage-budget";
export * from "./footprint";
export * from "./intake";
export * from "./parser";
export * from "./stage";
export * from "./worker";

/** Build a TiC queue for `tier` using this node's type (RAM_NODE env). */
export function createNodeQueue(tier: SizeTier): TicFileQueue {
  return new TicFileQueue(tier);
}
