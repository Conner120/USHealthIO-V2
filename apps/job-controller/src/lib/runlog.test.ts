import { test, expect, beforeEach, afterAll } from "bun:test";
import { mkdtemp, readdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as runlog from "./runlog";

// runlog resolves LOG_DIR per call, so pointing it at a scratch dir here is enough.
const dir = await mkdtemp(join(tmpdir(), "runlog-test-"));
process.env.LOG_DIR = dir;

beforeEach(() => runlog.reset());
afterAll(() => runlog.reset());

const flush = () => Bun.sleep(30); // file writes are fire-and-forget

test("lines are recorded, numbered, and returned incrementally", async () => {
  runlog.begin("j1", "file", "x.json.gz");
  runlog.append("j1", "[1/4] download");
  runlog.append("j1", "[2/4] staged");
  const all = runlog.lines("j1");
  expect(all.map((l) => [l.n, l.text])).toEqual([
    [1, "[1/4] download"],
    [2, "[2/4] staged"],
  ]);
  // `since` gives only newer lines — what an open expander polls with.
  expect(runlog.lines("j1", 1).map((l) => l.text)).toEqual(["[2/4] staged"]);
  expect(runlog.lines("j1", 2)).toEqual([]);
  await flush();
});

test("summary tracks status and counts; end marks done/failed", () => {
  runlog.begin("ok", "task", "index-scan");
  runlog.append("ok", "one");
  expect(runlog.summary("ok")).toMatchObject({ kind: "task", label: "index-scan", status: "running", lines: 1 });
  runlog.end("ok", false);
  expect(runlog.summary("ok")).toMatchObject({ status: "done" });

  runlog.begin("bad", "file", "y.gz");
  runlog.end("bad", true);
  expect(runlog.summary("bad")).toMatchObject({ status: "failed" });
  expect(runlog.summary("bad")!.endedAt).toBeString();
});

test("list puts running operations first", () => {
  runlog.begin("done1", "file", "a");
  runlog.end("done1", false);
  runlog.begin("live", "file", "b");
  expect(runlog.list().map((r) => r.id)).toEqual(["live", "done1"]);
});

test("unknown ids are handled without throwing", () => {
  expect(runlog.lines("nope")).toEqual([]);
  expect(runlog.summary("nope")).toBeNull();
  runlog.end("nope", false); // no-op
  // append to an unknown id creates a minimal run rather than losing the line
  runlog.append("orphan", "late line");
  expect(runlog.summary("orphan")).toMatchObject({ id: "orphan", lines: 1 });
});

test("history is written to the log dir and swept on the next boot", async () => {
  runlog.begin("persist", "file", "z.json.gz");
  runlog.append("persist", "hello from a previous boot");
  await flush();
  expect((await readdir(dir)).filter((f) => f.endsWith(".log"))).toContain("persist.log");
  expect(await Bun.file(join(dir, "persist.log")).text()).toContain("hello from a previous boot");

  // A fresh boot: index empty, directory still holds the old files.
  runlog.reset();
  expect(await runlog.sweep()).toBeGreaterThan(0);
  expect((await readdir(dir)).filter((f) => f.endsWith(".log"))).toEqual([]);
});

test("sweep leaves non-log files and a missing dir alone", async () => {
  const other = join(dir, "keep.txt");
  await writeFile(other, "not a log");
  await runlog.sweep();
  expect(await Bun.file(other).exists()).toBe(true);

  process.env.LOG_DIR = join(dir, "does-not-exist");
  runlog.reset();
  expect(await runlog.sweep()).toBe(0); // ENOENT is not an error
  process.env.LOG_DIR = dir;
  runlog.reset();
});

test("ids that are not path-safe cannot escape the log dir", async () => {
  runlog.begin("../../escape", "task", "evil");
  runlog.append("../../escape", "x");
  await flush();
  const files = await readdir(dir);
  expect(files.some((f) => f.includes(".."))).toBe(false);
});
