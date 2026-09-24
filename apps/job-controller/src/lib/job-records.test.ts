import { test, expect, beforeEach } from "bun:test";
import { buildRow, chTime, errorText, truncateLog, report, pendingCount, reset } from "./job-records";
import * as runlog from "./runlog";

beforeEach(() => {
  reset();
  runlog.reset();
});

test("chTime formats for DateTime64(3)", () => {
  expect(chTime(new Date("2026-09-23T14:05:06.789Z"))).toBe("2026-09-23 14:05:06.789");
});

test("errorText keeps the stack, tolerates non-Errors", () => {
  expect(errorText(new Error("boom"))).toContain("boom");
  expect(errorText("plain")).toBe("plain");
  expect(errorText(undefined)).toBe("");
  expect(errorText(null)).toBe("");
});

test("truncateLog keeps the tail and says what it dropped", () => {
  const text = ["line one", "line two", "line three"].join("\n");
  expect(truncateLog(text, 1000)).toBe(text); // under the limit: untouched
  const cut = truncateLog(text, 12);
  expect(cut).toContain("line three"); // the end, which is where failures are
  expect(cut).toContain("earlier bytes omitted");
  expect(cut).not.toContain("line one");
  expect(truncateLog(text, 0)).toBe(""); // 0 = do not store logs
});

test("truncateLog cuts on a line boundary", () => {
  const cut = truncateLog("aaaa\nbbbb\ncccc", 7);
  expect(cut.split("\n").slice(1).join("\n")).toBe("cccc"); // no half line
});

test("buildRow fills defaults and computes duration", () => {
  const startedAt = new Date("2026-09-23T10:00:00.000Z");
  const row = buildRow(
    { id: "j1", kind: "file", label: "x.json.gz", status: "running", startedAt, sizeBytes: 100 },
    new Date("2026-09-23T10:00:05.000Z"),
  );
  expect(row).toMatchObject({
    run_id: "j1",
    kind: "file",
    status: "running",
    label: "x.json.gz",
    size_bytes: 100,
    download_bytes: 0,
    json_bytes: 0,
    scan_job_id: "",
    url: "",
    tier: "",
    error: "",
    log: "",
    ended_at: null,
    duration_ms: 5000,
  });
  expect(row.node_id).toBeString();
});

test("a finished row carries the console output and the real duration", () => {
  const startedAt = new Date("2026-09-23T10:00:00.000Z");
  const endedAt = new Date("2026-09-23T10:00:02.500Z");
  runlog.begin("j2", "file", "y.gz");
  runlog.append("j2", "[1/4] download");
  runlog.append("j2", "[3/4] parsed in 2.5s");

  const row = buildRow({ id: "j2", kind: "file", label: "y.gz", status: "done", startedAt, endedAt, withLog: true });
  expect(row.duration_ms).toBe(2500);
  expect(row.ended_at).toBe("2026-09-23 10:00:02.500");
  expect(row.log).toContain("[1/4] download");
  expect(row.log).toContain("[3/4] parsed in 2.5s");
  expect(row.log_lines).toBe(2);
});

test("failed rows carry the error", () => {
  const row = buildRow({
    id: "j3",
    kind: "task",
    label: "index-scan",
    status: "failed",
    startedAt: new Date(),
    endedAt: new Date(),
    error: new Error("uhc-toc 503"),
  });
  expect(row.status).toBe("failed");
  expect(row.error).toContain("uhc-toc 503");
});

test("report queues rows; a running row waits for the flush", () => {
  report({ id: "q1", kind: "file", label: "a", status: "running", startedAt: new Date() });
  expect(pendingCount()).toBe(1);
});
