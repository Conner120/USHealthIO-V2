import { test, expect, beforeEach, afterAll } from "bun:test";
import { getRedis, closeRedis } from "./client";
import { pushBack, length, range } from "./deque";
import { take, ack, nack, inflightKey, deadKey, inFlightCount, listInFlight, reclaimOwned } from "./inflight";
import { beat, nodeKey, nodeId } from "./heartbeat";
import { reapDeadJobs, recoverSelf } from "./reaper";
import { claimUrl, claimUrlResolving, markSeen, releaseOwnLocks, lockKey, seenKey, SCOPES_KEY, withUrlClaim } from "./dedupe";

const Q = `test:queue:${crypto.randomUUID()}`;
const scope = `test-${crypto.randomUUID()}`;
const url = "https://example.test/f.json.gz";
const job = (id: string) => ({ id, url: `https://example.test/${id}` });
const r = getRedis();

beforeEach(async () => {
  await r.del(Q, inflightKey(Q), deadKey(Q), nodeKey("alive-node"), nodeKey("dead-node"), seenKey(scope), lockKey(scope, url));
});
afterAll(async () => {
  await r.del(Q, inflightKey(Q), deadKey(Q), nodeKey("alive-node"), seenKey(scope), lockKey(scope, url));
  await r.srem(SCOPES_KEY, scope);
  await closeRedis();
});

test("take moves the job into inflight under this node; ack removes it; nack returns it", async () => {
  await pushBack(Q, job("a"));
  await pushBack(Q, job("b"));
  const t = await take(Q, "me");
  expect(t).toMatchObject({ id: "a" });
  expect((await listInFlight(Q))[0]!.entry).toMatchObject({ item: { id: "a" }, node: "me" });
  expect(await nack(Q, t!)).toBe(true);
  expect((await range<{ id: string }>(Q)).map((j) => j.id)).toEqual(["a", "b"]);
  await take(Q, "me");
  await ack(Q, "a");
  expect(await inFlightCount(Q)).toBe(0);
});

test("reaper requeues jobs of dead nodes only, bumping attempts; parks after max attempts", async () => {
  await pushBack(Q, job("dead1"));
  await pushBack(Q, job("live1"));
  await pushBack(Q, { ...job("tired"), attempts: 2 });
  await take(Q, "dead-node");
  await take(Q, "alive-node");
  await take(Q, "dead-node");
  await beat("alive-node", 10_000);

  expect(await reapDeadJobs([Q], 3)).toEqual({ requeued: 1, dead: 1 });
  expect(await range(Q)).toEqual([{ id: "dead1", url: "https://example.test/dead1", attempts: 1 }]);
  expect((await listInFlight(Q)).map((e) => e.entry.item.id)).toEqual(["live1"]);
  expect(await length(deadKey(Q))).toBe(1);
});

test("two reapers racing on the same entry requeue it once", async () => {
  await pushBack(Q, job("r"));
  await take(Q, "dead-node");
  const [a, b] = await Promise.all([reapDeadJobs([Q], 3), reapDeadJobs([Q], 3)]);
  expect(a.requeued + b.requeued).toBe(1);
  expect(await length(Q)).toBe(1);
});

test("watch reload with a fixed NODE_ID: startup reclaims our own in-flight jobs and locks", async () => {
  // "previous instance" with the same id took a job and locked a url, then vanished
  await pushBack(Q, job("mine"));
  await take(Q); // under nodeId
  expect((await claimUrl(scope, url)).status).toBe("claimed");

  expect(await recoverSelf([Q])).toEqual({ requeued: 1, locksReleased: 1 });
  expect(await range(Q)).toEqual([{ id: "mine", url: "https://example.test/mine" }]); // attempts not bumped
  expect(await inFlightCount(Q)).toBe(0);
  expect((await claimUrl(scope, url)).status).toBe("claimed");
  expect(await reclaimOwned([Q])).toBe(0);
  expect(await releaseOwnLocks()).toBe(1);
});

test("url lock from a dead instance is taken over; from a live one is waited on", async () => {
  await claimUrl(scope, url, 60_000, "dead-node");
  const c = await claimUrlResolving(scope, url, 60_000, "me");
  expect(c.status).toBe("claimed");
  await markSeen(scope, url, c.token!);

  await r.del(seenKey(scope), lockKey(scope, url));
  await beat("alive-node", 10_000);
  const live = await claimUrl(scope, url, 60_000, "alive-node");
  const waiter = claimUrlResolving(scope, url, 60_000, "me");
  await Bun.sleep(600);
  await markSeen(scope, url, live.token!);
  expect((await waiter).status).toBe("seen");
});

test("withUrlClaim is scoped by scan job id", async () => {
  const other = `${scope}-other`;
  expect((await withUrlClaim(scope, url, async () => 1)).status).toBe("claimed");
  expect((await withUrlClaim(scope, url, async () => 1)).status).toBe("seen");
  expect((await withUrlClaim(other, url, async () => 1)).status).toBe("claimed");
  await r.del(seenKey(other));
  await r.srem(SCOPES_KEY, other);
  expect(nodeId).toMatch(/-[a-z0-9]{6}$/); // per-instance suffix
});
