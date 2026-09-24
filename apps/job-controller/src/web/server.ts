/**
 * Dashboard: what every live node is doing right now, and how much work is left.
 *
 *   GET /            the page (static HTML, polls the API)
 *   GET /api/status  one JSON snapshot: cluster activity + queue depths + run progress
 *
 * The server is read-only — it never enqueues, takes or clears anything, so having it open
 * cannot affect a run. It binds a random free port unless WEB_PORT is set (see port.ts).
 */
import {
  getQueueStatus,
  nodeId,
  progress as ledgerProgress,
  publishActivity,
  readClusterActivity,
  seenCount,
  settings,
  type NodeActivity,
} from "@repo/queue";
import { config } from "../config";
import * as runlog from "../lib/runlog";
import * as fileActivity from "../queue/tic/activity";
import { inFlight as filesInFlight } from "../queue/tic/worker";
import { inFlight as tasksInFlight } from "../queue/management/worker";
import { storageBudget } from "../queue/tic/storage-budget";
import index from "./index.html";
import { choosePort, openBrowser } from "./port";

const startedAt = new Date().toISOString();

/** This node's own snapshot, published to Redis and included in the API response. */
export function localActivity(): NodeActivity {
  return {
    nodeId,
    role: config.node.role,
    updatedAt: new Date().toISOString(),
    startedAt,
    jobs: config.node.isFile ? fileActivity.snapshot() : [],
    tasks: config.node.isManagement
      ? [...tasksInFlight.keys()].map((id) => ({ id, kind: "index-scan", startedAt }))
      : [],
    storage: config.node.isFile
      ? {
          totalBytes: config.storage.totalBytes,
          reservedBytes: storageBudget.reservedBytes,
          maxFileBytes: config.storage.maxFileBytes,
          expansionRatio: config.storage.expansionRatio,
          stagingDir: config.storage.stagingDir,
        }
      : null,
    limits: {
      maxConcurrentFiles: config.files.maxConcurrent,
      maxConcurrentTasks: config.management.maxConcurrentTasks,
    },
    completed: { ...fileActivity.totals },
  };
}

export interface StatusResponse {
  fetchedAt: string;
  thisNode: string;
  nodes: NodeActivity[];
  queues: Awaited<ReturnType<typeof getQueueStatus>>;
  progress: Awaited<ReturnType<typeof ledgerProgress>>;
  seenUrls: number;
  runningJobs: number;
  /** Operations this node has run since boot (running first), for the expander list. */
  runs: runlog.RunSummary[];
  logDir: string;
}

export async function status(): Promise<StatusResponse> {
  const [nodes, queues, progress, seenUrls] = await Promise.all([
    readClusterActivity(),
    getQueueStatus(0),
    ledgerProgress(),
    seenCount(),
  ]);
  // This node may not have published yet (first tick); show it regardless.
  const local = localActivity();
  const merged = nodes.some((n) => n.nodeId === local.nodeId)
    ? nodes.map((n) => (n.nodeId === local.nodeId ? local : n))
    : [local, ...nodes];
  return {
    fetchedAt: new Date().toISOString(),
    thisNode: nodeId,
    nodes: merged,
    queues,
    progress,
    seenUrls,
    runningJobs: merged.reduce((n, x) => n + x.jobs.length, 0),
    runs: runlog.list(),
    logDir: runlog.logDir(),
  };
}

let server: ReturnType<typeof Bun.serve> | null = null;
let publisher: ReturnType<typeof setInterval> | null = null;

/** Starts the dashboard. Returns the URL, or null when WEB_ENABLED=false. */
export function startWebServer(): string | null {
  if (server) return server.url.toString();
  const { port, autoOpen } = choosePort();

  server = Bun.serve({
    port,
    routes: {
      "/": index,
      "/api/status": async () => Response.json(await status()),
      // Console output of one operation. `since` returns only newer lines, so an open expander
      // polls cheaply. Logs live on this node, so this only serves this node's operations.
      "/api/logs/:id": (req) => {
        const id = req.params.id;
        const since = Number(new URL(req.url).searchParams.get("since") ?? 0);
        const run = runlog.summary(id);
        if (!run) return Response.json({ error: "unknown operation on this node" }, { status: 404 });
        return Response.json({ run, lines: runlog.lines(id, Number.isFinite(since) ? since : 0) });
      },
    },
    development: false,
    error: (e) => new Response(`dashboard error: ${e.message}`, { status: 500 }),
  });

  const url = `http://localhost:${server.port}`;
  console.log(`[web] dashboard on ${url}${port === 0 ? " (random free port; set WEB_PORT to pin it)" : ""}`);

  // Publish this node's activity so other nodes' dashboards can see it.
  publisher = setInterval(() => {
    publishActivity(localActivity()).catch((e) => console.warn("[web] publish activity failed:", e));
  }, settings.heartbeatIntervalMs);

  if (autoOpen) openBrowser(url);
  return url;
}

export async function stopWebServer(): Promise<void> {
  if (publisher) clearInterval(publisher);
  publisher = null;
  await server?.stop(true);
  server = null;
}
