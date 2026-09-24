import { test, expect } from "bun:test";
import { StorageBudget } from "./storage-budget";

test("reserve respects total and per-file limit", () => {
  const b = new StorageBudget(100, 50);
  expect(b.reserve(60)).toBe("too_large");
  expect(b.reserve(50)).toBe("ok");
  expect(b.reserve(50)).toBe("ok");
  expect(b.reserve(10)).toBe("no_room");
  b.release(50);
  expect(b.hasRoom(50)).toBe(true);
  expect(b.reserve(50)).toBe("ok");
});

test("release never goes negative", () => {
  const b = new StorageBudget(10, 10);
  b.release(5);
  expect(b.reservedBytes).toBe(0);
});

test("adjustJob swaps the 15x guess for the real staged size", () => {
  const b = new StorageBudget(100_000, 100_000);
  const job = { id: "j1", url: "https://x/f.json.gz", sizeBytes: 1_000 } as any;
  expect(b.reserve(15_000)).toBe("ok"); // what intake reserved
  b.adjustJob(job, 9_000); // file expanded 9x, not 15x
  expect(b.reservedBytes).toBe(9_000);
  b.releaseJob(job);
  expect(b.reservedBytes).toBe(0);
});

test("a job that expands past its reservation still balances on release", () => {
  const b = new StorageBudget(100_000, 100_000);
  const job = { id: "j2", url: "https://x/f.json.gz", sizeBytes: 1_000 } as any;
  b.reserve(15_000);
  b.adjustJob(job, 40_000); // 40x — over budget, but the bytes are really there
  expect(b.reservedBytes).toBe(40_000);
  b.releaseJob(job);
  expect(b.reservedBytes).toBe(0);
});

test("releaseJob without adjustJob gives back the reservation", () => {
  const b = new StorageBudget(100_000, 100_000);
  const job = { id: "j3", url: "https://x/f.json.gz", sizeBytes: 1_000 } as any;
  b.reserve(15_000); // 1_000 * default ratio 15
  b.releaseJob(job);
  expect(b.reservedBytes).toBe(0);
});
