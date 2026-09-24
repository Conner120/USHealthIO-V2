import { test, expect, beforeEach, afterEach } from "bun:test";
import { installShutdown, forceQuit } from "./shutdown";

const SIGNALS: NodeJS.Signals[] = ["SIGINT", "SIGTERM", "SIGHUP"];

// installShutdown attaches process-wide handlers; drop them between tests.
beforeEach(() => SIGNALS.forEach((s) => process.removeAllListeners(s)));
afterEach(() => SIGNALS.forEach((s) => process.removeAllListeners(s)));

/**
 * A stand-in for process.exit that records instead of leaving. It returns rather than throwing:
 * a throw does not propagate cleanly out of process.emit(), and the code after the real exit()
 * never runs anyway.
 */
function recordingExit() {
  const calls: number[] = [];
  const exit = ((code: number) => {
    calls.push(code);
    return undefined as never;
  }) as (code: number) => never;
  return { calls, exit };
}

test("first signal stops the loops without exiting", () => {
  const { calls, exit } = recordingExit();
  let woken = 0;
  const running = installShutdown({ onStop: () => woken++, timeoutMs: 0, exit });
  expect(running()).toBe(true);

  process.emit("SIGINT");
  expect(running()).toBe(false);
  expect(woken).toBe(1); // poll loops are woken out of their sleep immediately
  expect(calls).toEqual([]); // graceful: still draining
});

test("second signal force quits with code 130", () => {
  const { calls, exit } = recordingExit();
  installShutdown({ onStop: () => {}, timeoutMs: 0, exit });
  process.emit("SIGINT");
  expect(calls).toEqual([]);
  process.emit("SIGINT");
  expect(calls).toEqual([130]);
});

test("any second signal forces, not just a repeat of the first", () => {
  const { calls, exit } = recordingExit();
  installShutdown({ onStop: () => {}, timeoutMs: 0, exit });
  process.emit("SIGINT");
  process.emit("SIGTERM");
  expect(calls).toEqual([130]);
});

test("force quit happens on its own after the timeout", async () => {
  const { calls, exit } = recordingExit();
  installShutdown({ onStop: () => {}, timeoutMs: 10, exit });
  process.emit("SIGINT");
  expect(calls).toEqual([]); // graceful phase first
  await Bun.sleep(40);
  expect(calls).toEqual([130]);
});

test("timeoutMs = 0 waits forever", async () => {
  const { calls, exit } = recordingExit();
  installShutdown({ onStop: () => {}, timeoutMs: 0, exit });
  process.emit("SIGINT");
  await Bun.sleep(30);
  expect(calls).toEqual([]);
});

test("a second signal cancels the pending timeout instead of exiting twice", async () => {
  const { calls, exit } = recordingExit();
  installShutdown({ onStop: () => {}, timeoutMs: 20, exit });
  process.emit("SIGINT");
  process.emit("SIGINT"); // forces now
  await Bun.sleep(50); // the timer must not fire a second exit
  expect(calls).toEqual([130]);
});

test("forceQuit exits 130 even with no parsers running", () => {
  const { calls, exit } = recordingExit();
  forceQuit("test", exit);
  expect(calls).toEqual([130]);
});
