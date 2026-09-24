import { test, expect } from "bun:test";
import { choosePort, openCommand } from "./port";

test("no WEB_PORT: random free port (0) and auto-open", () => {
  expect(choosePort({})).toEqual({ port: 0, autoOpen: true });
  expect(choosePort({ WEB_PORT: "" })).toEqual({ port: 0, autoOpen: true });
  expect(choosePort({ WEB_PORT: "   " })).toEqual({ port: 0, autoOpen: true });
});

test("explicit WEB_PORT: that port, no auto-open", () => {
  expect(choosePort({ WEB_PORT: "3000" })).toEqual({ port: 3000, autoOpen: false });
});

test("WEB_OPEN overrides either default", () => {
  expect(choosePort({ WEB_PORT: "3000", WEB_OPEN: "true" }).autoOpen).toBe(true);
  expect(choosePort({ WEB_OPEN: "0" }).autoOpen).toBe(false);
  expect(choosePort({ WEB_OPEN: "false" }).autoOpen).toBe(false);
});

test("invalid WEB_PORT is rejected", () => {
  expect(() => choosePort({ WEB_PORT: "abc" })).toThrow("invalid WEB_PORT");
  expect(() => choosePort({ WEB_PORT: "70000" })).toThrow("invalid WEB_PORT");
  expect(() => choosePort({ WEB_PORT: "-1" })).toThrow("invalid WEB_PORT");
});

test("openCommand per platform", () => {
  expect(openCommand("http://x", "darwin")).toEqual(["open", "http://x"]);
  expect(openCommand("http://x", "linux")).toEqual(["xdg-open", "http://x"]);
  expect(openCommand("http://x", "win32")).toEqual(["cmd", "/c", "start", "", "http://x"]);
  expect(openCommand("http://x", "freebsd" as NodeJS.Platform)).toBeNull();
});
