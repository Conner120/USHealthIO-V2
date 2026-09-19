import type { IndexScanPayload, IndexScanType } from "@repo/queue";
import type { DiscoveredFile, Scanner } from "./types";
import { uhcIndexPageScanner, uhcTocScanner } from "./scans/uhc";

export type { IndexScanPayload, IndexScanType, Carrier } from "@repo/queue";
export * from "./types";
export * from "./worker";
export * as uhc from "./scans/uhc";

/** Scan type -> implementation. Keyed by payload.type. */
const SCANNERS: { [K in IndexScanType]: Scanner<Extract<IndexScanPayload, { type: K }>> } = {
  "uhc-index-page": uhcIndexPageScanner,
  "uhc-toc": uhcTocScanner,
};

/** Run the scanner matching the payload's type. */
export function runIndexScan(payload: IndexScanPayload): Promise<DiscoveredFile[]> {
  const scanner = SCANNERS[payload.type] as Scanner<IndexScanPayload>;
  return scanner.scan(payload);
}
