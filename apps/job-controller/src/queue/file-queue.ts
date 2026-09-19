import { fileQueueKey, type Owned, type SizeTier } from "@repo/queue";
import { config } from "../config";
import { Deque } from "./deque";

/** Where a file node stages files: RAM disk (fast, limited) or disk (durable, large). */
export type QueueType = "ram" | "disk";

/** This node's file queue type, from RAM_NODE. */
export const NODE_QUEUE_TYPE: QueueType = config.node.isRam ? "ram" : "disk";

/** Per-tier deque of file jobs. Runs on file nodes (RAM_NODE true/false). */
export class FileQueue<T extends Owned> extends Deque<T> {
  readonly key: string;
  readonly type: QueueType;

  constructor(
    readonly tier: SizeTier,
    type: QueueType = NODE_QUEUE_TYPE,
  ) {
    super();
    this.type = type;
    this.key = fileQueueKey(tier);
  }
}
