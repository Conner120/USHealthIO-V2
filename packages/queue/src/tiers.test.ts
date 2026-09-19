import { test, expect } from "bun:test";
import { tierFor } from "./tiers";

const MB = 1024 * 1024;
const GB = 1024 * MB;

test("tierFor buckets by size", () => {
  expect(tierFor(0)).toBe("xs");
  expect(tierFor(250 * MB - 1)).toBe("xs");
  expect(tierFor(250 * MB)).toBe("sm");
  expect(tierFor(1 * GB)).toBe("md");
  expect(tierFor(5 * GB)).toBe("lg");
  expect(tierFor(25 * GB)).toBe("xl");
});
