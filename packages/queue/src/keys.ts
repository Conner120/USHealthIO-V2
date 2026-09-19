import type { SizeTier } from "./tiers";
import type { TaskKind } from "./types";

/** File jobs, one list per size tier: `mrf:queue:md`. */
export function fileQueueKey(tier: SizeTier): string {
  return `mrf:queue:${tier}`;
}

/** Management tasks, one list per kind: `task:queue:index-scan`. */
export function taskQueueKey(kind: TaskKind): string {
  return `task:queue:${kind}`;
}
