import { test, expect } from "bun:test";
import { parseBytes } from "./config";

test("parseBytes", () => {
  expect(parseBytes("1024")).toBe(1024);
  expect(parseBytes("512MB")).toBe(512 * 1024 ** 2);
  expect(parseBytes("8GB")).toBe(8 * 1024 ** 3);
  expect(parseBytes("1.5G")).toBe(1.5 * 1024 ** 3);
  expect(() => parseBytes("lots")).toThrow();
});
