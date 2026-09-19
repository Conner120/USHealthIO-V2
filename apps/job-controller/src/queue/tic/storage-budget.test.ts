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
