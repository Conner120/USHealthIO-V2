import { test, expect } from "bun:test";
import { takeNext, takeWhileRoom } from "./intake";
import { StorageBudget } from "./storage-budget";
import type { FileJob, TicFileQueue } from "./file-queue";

/** Plain-JSON job: staging footprint == sizeBytes (no 15x expansion). */
function job(id: string, sizeBytes: number): FileJob {
  return { id, url: `https://x/${id}.json`, sizeBytes, tier: "xs", discoveredAt: new Date() };
}

/** Compressed job: staging footprint == sizeBytes * COMPRESSED_EXPANSION_RATIO (15x). */
function gzJob(id: string, sizeBytes: number): FileJob {
  return { id, url: `https://x/${id}.json.gz`, sizeBytes, tier: "xs", discoveredAt: new Date() };
}

/** Minimal in-memory deque for testing intake logic. `inflight` mirrors {key}:inflight. */
function memQueue(items: FileJob[], inflight = new Map<string, FileJob>()): TicFileQueue {
  return {
    type: "disk",
    tier: "xs",
    async push(j: FileJob) { items.push(j); },
    async pushFront(j: FileJob) { items.unshift(j); },
    async pop() { return items.shift() ?? null; },
    async take() { const j = items.shift() ?? null; if (j) inflight.set(j.id, j); return j; },
    async ack(j: FileJob) { inflight.delete(j.id); },
    async nack(j: FileJob) { if (!inflight.delete(j.id)) return false; items.unshift(j); return true; },
    async peek() { return items[0] ?? null; },
    async size() { return items.length; },
    async inFlight() { return inflight.size; },
    async clear() { items.length = 0; },
  } as unknown as TicFileQueue;
}

test("takeNext sends job back when no room", async () => {
  const items = [job("a", 80)];
  const inflight = new Map<string, FileJob>();
  const q = memQueue(items, inflight);
  const b = new StorageBudget(100, 100);
  b.reserve(50);
  const r = await takeNext(q, b);
  expect(r.status).toBe("no_room");
  expect(items[0]?.id).toBe("a");
  expect(inflight.size).toBe(0);
});

test("takeNext keeps a taken job in flight until acked; too-large is acked", async () => {
  const items = [job("big", 500), job("a", 30)];
  const inflight = new Map<string, FileJob>();
  const q = memQueue(items, inflight);
  const b = new StorageBudget(100, 100);
  expect((await takeNext(q, b)).status).toBe("too_large");
  expect(inflight.size).toBe(0);
  const r = await takeNext(q, b);
  expect(r.status).toBe("taken");
  expect([...inflight.keys()]).toEqual(["a"]);
});

test("a compressed job reserves 15x its download size", async () => {
  const items = [gzJob("gz", 10)];
  const inflight = new Map<string, FileJob>();
  const q = memQueue(items, inflight);
  const b = new StorageBudget(1000, 1000);
  const r = await takeNext(q, b);
  expect(r.status).toBe("taken");
  expect(r.status === "taken" && r.stagingBytes).toBe(150);
  expect(b.reservedBytes).toBe(150);
});

test("a compressed job over the limit once expanded is too_large", async () => {
  // 10 bytes compressed fits a 100-byte node; 150 bytes decompressed does not.
  const items = [gzJob("gz", 10)];
  const q = memQueue(items);
  const b = new StorageBudget(100, 100);
  expect((await takeNext(q, b)).status).toBe("too_large");
  expect(b.reservedBytes).toBe(0);
});

test("takeWhileRoom takes until full, skips too-large", async () => {
  const items = [job("a", 30), job("big", 500), job("b", 30), job("c", 60)];
  const q = memQueue(items);
  const b = new StorageBudget(100, 100);
  const taken = await takeWhileRoom(q, b);
  expect(taken.map((j) => j.id)).toEqual(["a", "b"]);
  expect(items.map((j) => j.id)).toEqual(["c"]);
  expect(b.availableBytes).toBe(40);
});
