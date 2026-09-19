// Connection
export { getRedis, pingRedis, closeRedis } from "./client";
export { settings } from "./settings";

// Putting work in (start here)
export { enqueueTask, enqueueFile, enqueueTasksDeduped, type EnqueueOptions, type EnqueueFileInput, type DedupedTaskInput, type EnqueueBatchResult } from "./enqueue";

// Types + keys + tiers
export * from "./types";
export { fileQueueKey, taskQueueKey } from "./keys";
export { SIZE_TIERS, tierFor, type SizeTier } from "./tiers";

// Queue mechanics (used by workers)
export * as deque from "./deque";
export { take, ack, nack, requeue, listInFlight, inFlightCount, deadCount, inflightKey, deadKey, type Owned, type InFlight } from "./inflight";
export { nodeId, startHeartbeat, stopHeartbeat, beat, isAlive, liveNodes, nodeKey } from "./heartbeat";
export { startReaper, stopReaper, reapDeadJobs, recoverSelf, allQueueKeys, type ReapResult } from "./reaper";

// Run bookkeeping
export { trackTask, trackFile, finishTask, finishFile, progress, clearLedger, type Progress, FILE_FAILED_KEY, fileJobsKey } from "./ledger";
export { withUrlClaim, claimUrl, markSeen, releaseUrl, isSeen, seenCount, seenScopes, clearSeen, seenKey, SCOPES_KEY, type Claim, type UrlClaim } from "./dedupe";

// Observability
export { getQueueStatus, type QueueStatus, type FileQueueStatus, type TaskQueueStatus } from "./status";
export { encode, decode } from "./codec";
