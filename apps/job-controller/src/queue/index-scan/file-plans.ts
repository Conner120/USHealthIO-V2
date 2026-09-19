/**
 * Keeps a queued file linked to every plan that references it.
 *
 * Dedupe means a shared file becomes one FileJob, but each TOC that lists it
 * names different plans. So plan links are written per *reference* — first
 * discovery and every duplicate alike — into ClickHouse
 * `health.mrf_file_plans`, keyed by file URL and the FileJob id that will
 * become `insurance_scan_job_id` on the parsed rates.
 *
 *   mrf:file:job:{scope}   HASH url -> FileJob.id, so duplicates can find the
 *                          id of the job queued for their URL. Segmented by
 *                          scan job id like the seen set; cleared with the run.
 */
import { getRedis, fileJobsKey } from "@repo/queue";
import { clickhouse } from "../../clients/clickhouse";
import type { DiscoveredFile } from "./types";

export const FILE_PLANS_TABLE = "mrf_file_plans";

export async function rememberFileJob(scope: string, url: string, jobId: string): Promise<void> {
  await getRedis().hset(fileJobsKey(scope), url, jobId);
}

export async function fileJobIdFor(scope: string, url: string): Promise<string | null> {
  return getRedis().hget(fileJobsKey(scope), url);
}

export interface FilePlanRow {
  file_url: string;
  file_job_id: string;
  file_type: string;
  index_url: string;
  reporting_entity_name: string;
  reporting_entity_type: string;
  plan_name: string;
  plan_id_type: string;
  plan_id: string;
  plan_market_type: string;
  plan_sponsor_name: string;
  issuer_name: string;
  discovered_at: string; // "YYYY-MM-DD HH:MM:SS"
}

export function filePlanRows(f: DiscoveredFile, fileJobId: string): FilePlanRow[] {
  const discovered_at = f.foundAt.toISOString().slice(0, 19).replace("T", " ");
  return (f.plans ?? []).map((p) => ({
    file_url: f.url,
    file_job_id: fileJobId,
    file_type: f.fileType ?? "",
    index_url: f.indexUrl ?? "",
    reporting_entity_name: f.reportingEntity ?? "",
    reporting_entity_type: f.reportingEntityType ?? "",
    plan_name: p.planName,
    plan_id_type: p.planIdType,
    plan_id: p.planId,
    plan_market_type: p.planMarketType,
    plan_sponsor_name: p.planSponsorName ?? "",
    issuer_name: p.issuerName ?? "",
    discovered_at,
  }));
}

/** Collects (file, plan) links for one task and writes them in a single insert. */
export class FilePlanBatch {
  private rows: FilePlanRow[] = [];

  add(f: DiscoveredFile, fileJobId: string | null): void {
    this.rows.push(...filePlanRows(f, fileJobId ?? ""));
  }

  get size(): number {
    return this.rows.length;
  }

  async flush(): Promise<number> {
    if (this.rows.length === 0) return 0;
    const n = this.rows.length;
    await clickhouse.insert({ table: FILE_PLANS_TABLE, values: this.rows, format: "JSONEachRow" });
    this.rows = [];
    return n;
  }
}
