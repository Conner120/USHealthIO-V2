import { TaskQueue } from "../task-queue";
import type { Task, TaskKind } from "@repo/queue";

export type { Task, TaskKind, TaskPayloadMap } from "@repo/queue";
export { TASK_KINDS } from "@repo/queue";

/** TaskQueue specialised to management tasks. One queue per kind. */
export class ManagementQueue<K extends TaskKind = TaskKind> extends TaskQueue<Task<K>> {
  constructor(readonly kind: K) {
    super(kind);
  }
}
