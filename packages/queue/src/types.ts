import type { SizeTier } from "./tiers";

// ── File jobs (file nodes) ───────────────────────────────────────────────

/** One discovered MRF file waiting to be parsed. */
export interface FileJob {
  id: string;
  url: string;
  sizeBytes: number;
  tier: SizeTier;
  discoveredAt: Date;
  /** Optional link back to the admin's InsuranceScanJob row. */
  scanJobId?: string;
  /** Times this job was reassigned after its owner died. */
  attempts?: number;
}

// ── Index-scan payloads (per carrier) ────────────────────────────────────

/** Scan the UHC listing page for index JSON files. */
export interface UhcIndexPagePayload {
  carrier: "uhc";
  type: "uhc-index-page";
  url?: string; // default: https://transparency-in-coverage.uhc.com/
  /** Only keep index files whose name matches, e.g. "UnitedHealthcare-Insurance-Company". */
  entityFilter?: string;
}

/** Scan one UHC index (table-of-contents) JSON for MRF file URLs. */
export interface UhcTocPayload {
  carrier: "uhc";
  type: "uhc-toc";
  url: string;
  reportingEntity?: string;
}

export type UhcScanPayload = UhcIndexPagePayload | UhcTocPayload;

/** All index-scan payloads, discriminated on `type`. UHC only for now. */
export type IndexScanPayload = UhcScanPayload;
export type IndexScanType = IndexScanPayload["type"];
export type Carrier = IndexScanPayload["carrier"];

// ── Management tasks (management nodes) ──────────────────────────────────

/**
 * Task kind -> payload type. The single lookup table: add a kind here and
 * `enqueueTask(kind, payload)` / `Task<kind>` are typed automatically.
 */
export interface TaskPayloadMap {
  "index-scan": IndexScanPayload;
  discovery: { source: string };
  cleanup: { olderThanDays: number };
}

export type TaskKind = keyof TaskPayloadMap;
export const TASK_KINDS = ["index-scan", "discovery", "cleanup"] as const satisfies readonly TaskKind[];

/** One unit of non-file work for a management node. */
export interface Task<K extends TaskKind = TaskKind> {
  id: string;
  kind: K;
  payload: TaskPayloadMap[K];
  createdAt: Date;
  attempts: number;
  /** Optional link back to the admin's InsuranceScanJob row. */
  scanJobId?: string;
}
