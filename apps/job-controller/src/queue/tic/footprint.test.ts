import { test, expect } from "bun:test";
import { isCompressed, stagingBytesFor, formatBytes } from "./footprint";

const job = (url: string, sizeBytes: number) => ({ url, sizeBytes });

test("compressed extensions budget 15x, plain JSON budgets 1x", () => {
  expect(stagingBytesFor(job("https://x/f.json.gz", 1_000), 15)).toBe(15_000);
  expect(stagingBytesFor(job("https://x/f.json.zip", 1_000), 15)).toBe(15_000);
  expect(stagingBytesFor(job("https://x/f.json.zst", 1_000), 15)).toBe(15_000);
  expect(stagingBytesFor(job("https://x/f.json", 1_000), 15)).toBe(1_000);
  expect(stagingBytesFor(job("https://x/f.ndjson", 1_000), 15)).toBe(1_000);
});

test("query strings and case do not hide the extension", () => {
  expect(isCompressed("https://x/f.JSON.GZ?sv=2024&sig=abc")).toBe(true);
  expect(isCompressed("https://x/f.json?sv=2024&sig=abc")).toBe(false);
  expect(isCompressed("https://x/f.json#frag")).toBe(false);
});

test("unknown extensions are treated as compressed (safe direction)", () => {
  expect(isCompressed("https://drive.google.com/uc?export=download&id=abc")).toBe(true);
  expect(stagingBytesFor(job("https://x/mystery", 2_000), 15)).toBe(30_000);
});

test("ratio is configurable and rounds up", () => {
  expect(stagingBytesFor(job("https://x/f.gz", 100), 12.5)).toBe(1_250);
  expect(stagingBytesFor(job("https://x/f.gz", 3), 1.5)).toBe(5);
});

test("formatBytes", () => {
  expect(formatBytes(9_510_420_547)).toBe("9.51 GB");
  expect(formatBytes(6_044_383)).toBe("6.0 MB");
});
