import { taskQueueKey, type TaskKind } from "@repo/queue";
import type { Owned } from "@repo/queue";
import { Deque } from "./deque";

/** Named deque of non-file tasks. Runs on management nodes (MANAGEMENT_NODE=true). */
export class TaskQueue<T extends Owned> extends Deque<T> {
  readonly key: string;

  constructor(readonly name: TaskKind) {
    super();
    this.key = taskQueueKey(name);
  }
}
