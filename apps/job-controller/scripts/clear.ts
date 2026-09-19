/**
 * Empty queues.
 *
 *   bun scripts/clear.ts            # all file + task queues (+ their inflight/dead)
 *   bun scripts/clear.ts files      # only mrf:queue:*
 *   bun scripts/clear.ts tasks      # only task:queue:*
 *   bun scripts/clear.ts --all      # everything above plus the ledger and seen-URL set
 */
import { clearLedger, closeRedis, deadKey, deque, allQueueKeys, getRedis, inflightKey, pingRedis } from "@repo/queue";

const args = process.argv.slice(2);
const which = args.find((a) => !a.startsWith("--")) ?? "all";
await pingRedis();

const keys = allQueueKeys().filter((k) => which === "all" || (which === "files" ? k.startsWith("mrf:") : k.startsWith("task:")));

for (const key of keys) {
  await Promise.all([deque.clear(key), deque.clear(inflightKey(key)), deque.clear(deadKey(key))]);
  console.log("cleared", key);
}
if (args.includes("--all")) {
  await clearLedger();
  // Pre-segmentation keys (before seen/file:job were scoped by scan job id).
  await getRedis().del("mrf:seen:urls", "mrf:file:job");
  const locks = await getRedis().keys("mrf:lock:*");
  if (locks.length) await getRedis().del(...locks);
  console.log("cleared ledger + seen urls + locks");
}

await closeRedis();
