"use client";
import { useEffect, useState } from "react";
import type { QueueStatus } from "@repo/queue";
import { fetchQueueStatus } from "@/lib/queue";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

const REFRESH_MS = 3000;

export function QueueDashboard({ initial }: { initial: QueueStatus }) {
  const [status, setStatus] = useState(initial);
  const [paused, setPaused] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const refresh = async () => {
    setRefreshing(true);
    try {
      setStatus(await fetchQueueStatus());
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (paused) return;
    const t = setInterval(refresh, REFRESH_MS);
    return () => clearInterval(t);
  }, [paused]);

  const { progress, nodes, seenUrls, waitingBytes, files, tasks } = status;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <span>Updated {new Date(status.fetchedAt).toLocaleTimeString()}</span>
        {refreshing && <Spinner />}
        <div className="mr-auto" />
        <Button variant="outline" size="sm" onClick={refresh}>Refresh</Button>
        <Button variant="outline" size="sm" onClick={() => setPaused((p) => !p)}>
          {paused ? "Resume auto-refresh" : "Pause"}
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
        <Stat label="Pending tasks" value={progress.pendingTasks} />
        <Stat label="Pending files" value={progress.pendingFiles} />
        <Stat label="To download" value={formatBytes(waitingBytes)} />
        <Stat label="Failed files" value={progress.failedFiles} />
        <Stat label="Seen URLs" value={seenUrls} />
        <Stat label="Live nodes" value={nodes.length} hint={nodes.join(", ") || "none"} />
      </div>

      <Card>
        <CardHeader><CardTitle>Task queues (management nodes)</CardTitle></CardHeader>
        <CardContent>
          <Table className="table-fixed">
            <TableHeader>
              <TableRow>
                <TableHead className="w-32">Kind</TableHead>
                <TableHead className="w-24 text-right">Waiting</TableHead>
                <TableHead className="w-24 text-right">In flight</TableHead>
                <TableHead className="w-20 text-right">Dead</TableHead>
                <TableHead>Next up</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tasks.map((q) => (
                <TableRow key={q.key}>
                  <TableCell className="font-mono">{q.kind}</TableCell>
                  <Num n={q.waiting} />
                  <Num n={q.inflight} />
                  <Num n={q.dead} warn />
                  <NextUp text={q.head[0] ? JSON.stringify(q.head[0].payload) : undefined} />
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>File queues (file nodes, by size tier)</CardTitle></CardHeader>
        <CardContent>
          <Table className="table-fixed">
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">Tier</TableHead>
                <TableHead className="w-24">Size</TableHead>
                <TableHead className="w-24 text-right">Waiting</TableHead>
                <TableHead className="w-28 text-right">To download</TableHead>
                <TableHead className="w-24 text-right">In flight</TableHead>
                <TableHead className="w-20 text-right">Dead</TableHead>
                <TableHead>Next up</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {files.map((q) => (
                <TableRow key={q.key}>
                  <TableCell className="font-mono">{q.tier}</TableCell>
                  <TableCell className="text-muted-foreground">{q.label}</TableCell>
                  <Num n={q.waiting} />
                  <TableCell className="text-right tabular-nums" title={`${q.waitingBytes.toLocaleString()} bytes`}>
                    {formatBytes(q.waitingBytes)}
                  </TableCell>
                  <Num n={q.inflight} />
                  <Num n={q.dead} warn />
                  <NextUp text={q.head[0]?.url} />
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  const units = ["KB", "MB", "GB", "TB", "PB"];
  let v = n / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(v >= 100 ? 0 : 1)} ${units[i]}`;
}

function Stat({ label, value, hint }: { label: string; value: number | string; hint?: string }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="text-sm text-muted-foreground">{label}</div>
        <div className="text-2xl font-bold">{value}</div>
        {hint && <div className="text-xs text-muted-foreground truncate" title={hint}>{hint}</div>}
      </CardContent>
    </Card>
  );
}

/** Fixed-width cell that truncates long payloads/URLs; full value on hover. */
function NextUp({ text }: { text?: string }) {
  return (
    <TableCell className="max-w-[28rem] w-[28rem]">
      <div className="truncate font-mono text-xs text-muted-foreground" title={text}>
        {text ?? "—"}
      </div>
    </TableCell>
  );
}

function Num({ n, warn }: { n: number; warn?: boolean }) {
  return <TableCell className={`text-right tabular-nums ${warn && n > 0 ? "text-destructive font-medium" : ""}`}>{n}</TableCell>;
}
