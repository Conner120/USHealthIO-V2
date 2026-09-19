"use client";
import { useState } from "react";
import Link from "next/link";
import { CheckCircle } from "lucide-react";
import { triggerUhcScan, triggerUhcToc } from "@/lib/queue";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";

type State = { status: "idle" } | { status: "sending" } | { status: "sent"; id: string } | { status: "error"; message: string };

function useSend() {
  const [state, setState] = useState<State>({ status: "idle" });
  const send = async (fn: () => Promise<{ id: string }>) => {
    setState({ status: "sending" });
    try {
      const t = await fn();
      setState({ status: "sent", id: t.id });
    } catch (e) {
      setState({ status: "error", message: e instanceof Error ? e.message : String(e) });
    }
  };
  return { state, send };
}

function Result({ state }: { state: State }) {
  if (state.status === "sending") return <Spinner />;
  if (state.status === "sent")
    return (
      <span className="flex items-center gap-2 text-sm text-muted-foreground">
        <CheckCircle className="size-4 text-green-600" /> queued <span className="font-mono">{state.id}</span>
      </span>
    );
  if (state.status === "error") return <span className="text-sm text-destructive">{state.message}</span>;
  return null;
}

export function TestJobsForm() {
  const [entityFilter, setEntityFilter] = useState("");
  const [tocUrl, setTocUrl] = useState("");
  const page = useSend();
  const toc = useSend();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>UHC — scan listing page</CardTitle>
          <CardDescription>
            Enqueues <code>index-scan</code> / <code>uhc-index-page</code>. A management node scans
            transparency-in-coverage.uhc.com and spawns one <code>uhc-toc</code> task per index file.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="uhc-entity">Entity filter (optional)</FieldLabel>
              <Input
                id="uhc-entity"
                placeholder="UnitedHealthcare-Insurance-Company"
                value={entityFilter}
                onChange={(e) => setEntityFilter(e.target.value)}
              />
            </Field>
          </FieldGroup>
        </CardContent>
        <CardFooter className="gap-4">
          <Button disabled={page.state.status === "sending"} onClick={() => page.send(() => triggerUhcScan(entityFilter))}>
            Send UHC scan
          </Button>
          <Result state={page.state} />
        </CardFooter>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>UHC — scan one index JSON</CardTitle>
          <CardDescription>Enqueues <code>uhc-toc</code> for a single table-of-contents URL.</CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="uhc-toc-url">Index JSON URL</FieldLabel>
              <Input
                id="uhc-toc-url"
                placeholder="https://…/2026-09-01_UnitedHealthcare-Insurance-Company_index.json"
                value={tocUrl}
                onChange={(e) => setTocUrl(e.target.value)}
              />
            </Field>
          </FieldGroup>
        </CardContent>
        <CardFooter className="gap-4">
          <Button disabled={!tocUrl || toc.state.status === "sending"} onClick={() => toc.send(() => triggerUhcToc(tocUrl))}>
            Send TOC scan
          </Button>
          <Result state={toc.state} />
        </CardFooter>
      </Card>

      <p className="text-sm text-muted-foreground">
        Watch it run on the <Link className="underline" href="/jobs/queues">Job Queues</Link> page.
      </p>
    </div>
  );
}
