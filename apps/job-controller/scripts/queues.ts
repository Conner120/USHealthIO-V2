/**
 * Inspect the queues, ownership and run progress.
 *
 *   bun scripts/queues.ts          # waiting / in-flight / dead per queue, live nodes, ledger
 *   bun scripts/queues.ts --peek   # also print the head item of each queue
 *   bun scripts/queues.ts reap     # reassign jobs owned by dead nodes now
 */
import { closeRedis, getQueueStatus, pingRedis, reapDeadJobs } from "@repo/queue";

const args = process.argv.slice(2);
await pingRedis();

if (args[0] === "reap") {
  console.log(await reapDeadJobs());
} else {
  const peek = args.includes("--peek");
  const s = await getQueueStatus(1);
  console.log("queue".padEnd(24), "waiting".padStart(8), "inflight".padStart(9), "dead".padStart(6));
  for (const q of [...s.tasks, ...s.files]) {
    console.log(q.key.padEnd(24), String(q.waiting).padStart(8), String(q.inflight).padStart(9), String(q.dead).padStart(6));
    if (peek && q.head[0]) console.log("  head:", q.head[0]);
  }
  console.log("live nodes".padEnd(24), s.nodes.join(", ") || "-");
  console.log("progress".padEnd(24), s.progress);
  console.log("seen urls".padEnd(24), s.seenUrls);
}

await closeRedis();
