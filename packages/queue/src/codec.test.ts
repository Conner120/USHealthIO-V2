import { test, expect } from "bun:test";
import { decode, encode } from "./codec";

test("dates round-trip", () => {
  const d = new Date("2026-09-18T12:00:00.000Z");
  const out = decode<{ at: Date; s: string }>(encode({ at: d, s: "plain" }));
  expect(out.at).toBeInstanceOf(Date);
  expect(out.at.getTime()).toBe(d.getTime());
  expect(out.s).toBe("plain");
});
