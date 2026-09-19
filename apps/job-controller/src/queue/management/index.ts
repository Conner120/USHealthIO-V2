import { ManagementQueue, TASK_KINDS, type TaskKind } from "./task";

export * from "./task";
export * from "./worker";

export function createManagementQueue<K extends TaskKind>(kind: K): ManagementQueue<K> {
  return new ManagementQueue(kind);
}

/** One queue per task kind. */
export function createAllManagementQueues(): ManagementQueue[] {
  return TASK_KINDS.map((k) => createManagementQueue(k) as ManagementQueue);
}
