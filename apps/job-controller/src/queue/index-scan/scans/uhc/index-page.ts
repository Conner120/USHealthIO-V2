import type { UhcIndexPagePayload } from "@repo/queue";
import type { Scanner, DiscoveredFile } from "../../types";

export const UHC_BASE_URL = "https://transparency-in-coverage.uhc.com/";
/** Blob listing API behind the UHC page: every blob for the current month, with sizes. */
export const UHC_BLOBS_URL = "https://transparency-in-coverage.uhc.com/api/v1/uhc/blobs/";

/** One entry in the blobs API response. */
export interface UhcBlob {
  name: string;
  downloadUrl: string;
  size: number;
}

export interface UhcBlobsResponse {
  blobs: UhcBlob[];
}

/**
 * Finds UHC index JSON files via the blob listing API. Each result is a
 * table-of-contents file (fileType "table-of-contents"), which the worker
 * turns into a follow-up "uhc-toc" task rather than a FileJob.
 */
export const uhcIndexPageScanner: Scanner<UhcIndexPagePayload> = {
  async scan(payload): Promise<DiscoveredFile[]> {
    const url = payload.url ?? UHC_BLOBS_URL;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`uhc-index-page: ${url} -> ${res.status}`);
    const { blobs } = (await res.json()) as UhcBlobsResponse;

    const foundAt = new Date();
    const filter = payload.entityFilter?.toLowerCase();
    const out: DiscoveredFile[] = [];
    for (const b of blobs) {
      if (!b.name.endsWith("_index.json")) continue;
      if (filter && !b.name.toLowerCase().includes(filter)) continue;
      out.push({
        url: b.downloadUrl,
        sizeBytes: b.size,
        fileType: "table-of-contents",
        reportingEntity: entityFromIndexName(b.name),
        foundAt,
      });
    }
    if (filter && out.length === 0) {
      console.warn(`[uhc-index-page] ${blobs.length} blobs, none matched entityFilter "${payload.entityFilter}"`);
    }
    return out;
  },
};

/** "2026-09-01_1-AB-Inc_index.json" -> "1-AB-Inc" */
export function entityFromIndexName(name: string): string {
  return name.replace(/^\d{4}-\d{2}-\d{2}_/, "").replace(/_index\.json$/, "");
}
