import { test, expect, beforeEach } from "bun:test";
import * as activity from "./activity";
import type { FileJob } from "./file-queue";

const job = (id: string, sizeBytes = 1000): FileJob => ({
  id,
  url: `https://x/${id}_in-network-rates.json.gz`,
  sizeBytes,
  tier: "xs",
  discoveredAt: new Date(),
});

beforeEach(() => activity.reset());

test("a job moves through the steps with download progress", () => {
  activity.begin(job("a"), 15_000);
  let [j] = activity.snapshot();
  expect(j).toMatchObject({ id: "a", step: "downloading", stepProgress: 0, stagingBytes: 15_000 });
  expect(j!.name).toBe("a_in-network-rates.json.gz");

  activity.progress("a", 250, 1000);
  expect(activity.snapshot()[0]!.stepProgress).toBe(0.25);

  // No Content-Length: fall back to the queued size.
  activity.progress("a", 500);
  expect(activity.snapshot()[0]!.stepProgress).toBe(0.5);

  activity.step("a", "decompressing");
  [j] = activity.snapshot();
  expect(j).toMatchObject({ step: "decompressing", stepProgress: null });

  activity.step("a", "parsing");
  activity.detail("a", "parser: done in 3.2s");
  expect(activity.snapshot()[0]).toMatchObject({ step: "parsing", detail: "parser: done in 3.2s" });
});

test("both sizes are reported: estimate first, real sizes once staged", () => {
  activity.begin(job("s", 1000), 15_000);
  let [j] = activity.snapshot();
  expect(j).toMatchObject({ sizeBytes: 1000, downloadBytes: null, jsonBytes: null, stagingBytes: 15_000 });

  activity.staged("s", 1024, 9_000); // downloaded 1 KB, expanded to 9 KB (not the assumed 15x)
  [j] = activity.snapshot();
  expect(j).toMatchObject({ sizeBytes: 1000, downloadBytes: 1024, jsonBytes: 9_000, bytesDone: 1024 });
});

test("progress is clamped and survives an unknown size", () => {
  activity.begin(job("b", 0), 0);
  activity.progress("b", 10);
  expect(activity.snapshot()[0]!.stepProgress).toBeNull();
  activity.progress("b", 99_999, 1000);
  expect(activity.snapshot()[0]!.stepProgress).toBe(1);
});

test("end removes the job and counts it", () => {
  activity.begin(job("c"), 1);
  activity.begin(job("d"), 1);
  activity.end("c", false);
  activity.end("d", true);
  expect(activity.snapshot()).toHaveLength(0);
  expect(activity.totals).toMatchObject({ files: 2, failedFiles: 1 });
});

test("updates for an unknown job are ignored", () => {
  activity.progress("nope", 1);
  activity.step("nope", "parsing");
  activity.detail("nope", "x");
  expect(activity.snapshot()).toHaveLength(0);
});

test("snapshot is ordered by start time", () => {
  activity.begin(job("first"), 1);
  activity.begin(job("second"), 1);
  expect(activity.snapshot().map((j) => j.id)).toEqual(["first", "second"]);
});
