import { config } from "./config";
import { pingClickHouse } from "./clients/clickhouse";
import { pingRedis, SIZE_TIERS, nodeId, startHeartbeat, stopHeartbeat, startReaper, stopReaper, recoverSelf, closeRedis } from "@repo/queue";
import * as tic from "./queue/tic";
import * as mgmt from "./queue/management";

const role = config.node.isManagement ? "management" : config.node.isRam ? "ram" : "disk";

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

  let running = true;
  const stop = () => { running = false; };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
  process.on("SIGHUP", stop);

  if (config.node.isManagement) {
    await runManagementNode(() => running);
  } else {
    await runFileNode(() => running);
  }
  // In-flight work is drained by now; drop our liveness key so nothing is reaped.
  stopReaper();
  await stopHeartbeat();
  await closeRedis();
}

/** File node: start any file job that fits; jobs release space as they finish. */
async function runFileNode(running: () => boolean) {
  const queues = SIZE_TIERS.map((t) => tic.createNodeQueue(t.name));
  while (running()) {
    for (const q of queues) await tic.pollQueue(q);
    await Bun.sleep(config.queue.pollIntervalMs);
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
