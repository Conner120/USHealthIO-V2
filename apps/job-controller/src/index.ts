import { config } from "./config";
import { pingClickHouse } from "./clients/clickhouse";
import { pingRedis, SIZE_TIERS, nodeId, startHeartbeat, stopHeartbeat, startReaper, stopReaper, recoverSelf, clearActivity, closeRedis } from "@repo/queue";
import * as records from "./lib/job-records";
import * as runlog from "./lib/runlog";
import { installShutdown } from "./shutdown";
import { startWebServer, stopWebServer } from "./web/server";
import * as tic from "./queue/tic";
import * as mgmt from "./queue/management";

const role = config.node.role;

async function main() {
  await Promise.all([pingClickHouse(), pingRedis()]);
  console.log(
    `[job-controller] connected — node=${role} id=${nodeId} clickhouse=${config.clickhouse.url}/${config.clickhouse.database} redis=${config.redis.url}`,
  );
  await startHeartbeat();
  // `bun --watch` re-execs in place with no signal or exit hook, so a previous
  // instance can't drain. Reclaim anything it left under our id, then run the
  // reaper so leftovers under an old instance id are reassigned promptly.
  const recovered = await recoverSelf();
  if (recovered.requeued || recovered.locksReleased) console.warn("[job-controller] recovered from previous instance:", recovered);
  startReaper();
  // Console-output history is per boot: clear what a previous run of this node left behind.
  await runlog.sweep();
  records.start();
  if (config.web.enabled) startWebServer();

  // First signal drains; a second one (or SHUTDOWN_TIMEOUT_MS) force quits — see shutdown.ts.
  const running = installShutdown({
    timeoutMs: config.queue.shutdownTimeoutMs,
    onStop: () => {
      // Wake both poll loops so they do not sit out the poll interval before noticing.
      tic.wakeNow();
      mgmt.wakeNow();
    },
  });

  // Roles are independent and run side by side: a node can poll management tasks and file
  // queues at the same time (MANAGEMENT_NODE=true FILE_NODE=true).
  const loops: Promise<void>[] = [];
  if (config.node.isManagement) loops.push(runManagementNode(running));
  if (config.node.isFile) loops.push(runFileNode(running));
  if (loops.length === 0) {
    console.warn("[job-controller] no role enabled — set MANAGEMENT_NODE and/or FILE_NODE");
  }
  await Promise.all(loops);
  // In-flight work is drained by now; drop our liveness key so nothing is reaped.
  console.log("[job-controller] in-flight work finished; shutting down");
  stopReaper();
  await records.stop(); // flush the last job records before the connection closes
  await stopWebServer();
  await clearActivity();
  await stopHeartbeat();
  await closeRedis();
}

/** File role: start any file job that fits, up to MAX_CONCURRENT_FILES. */
async function runFileNode(running: () => boolean) {
  // A previous instance may have died mid-job; its staged files are ours to clear.
  await tic.sweepStagingDir();
  console.log(
    `[job-controller] staging ${config.storage.stagingDir} — ${(config.storage.totalBytes / 1e9).toFixed(0)} GB budget, ` +
      `max ${(config.storage.maxFileBytes / 1e9).toFixed(0)} GB per file (decompressed), ${config.storage.expansionRatio}x assumed expansion, ` +
      `${config.files.maxConcurrent} concurrent jobs`,
  );
  const queues = SIZE_TIERS.map((t) => tic.createNodeQueue(t.name));
  while (running()) {
    if (tic.hasFreeSlot()) for (const q of queues) await tic.pollQueue(q);
    // Either every slot is busy (wake on the first finish) or the queues are empty.
    await tic.waitForSlotOrTimeout(config.queue.pollIntervalMs);
  }
  console.log(`[job-controller] stopping, waiting on in-flight jobs…`);
  await tic.drain();
}

/**
 * Management node: keep MAX_CONCURRENT_TASKS tasks running. Slots are refilled
 * the moment a task finishes; POLL_INTERVAL_MS is only the backoff while the
 * queues are empty (or all slots are busy and nothing has finished yet).
 */
async function runManagementNode(running: () => boolean) {
  const queues = mgmt.createAllManagementQueues();
  while (running()) {
    if (mgmt.hasFreeSlot()) for (const q of queues) await mgmt.pollTaskQueue(q);
    // Either every slot is busy (wake on the first finish) or the queues are
    // empty (re-check after the poll interval).
    await mgmt.waitForSlotOrTimeout(config.queue.pollIntervalMs);
  }
  console.log(`[job-controller] stopping, waiting on in-flight tasks…`);
  await mgmt.drain();
}

main().catch((err) => {
  console.error("[job-controller] fatal:", err);
  process.exit(1);
});
