/** One plan a file applies to, as listed in the carrier's index (TOC). */
export interface FilePlan {
  planName: string;
  planId: string;
  planIdType: string;
  planMarketType: string;
  planSponsorName?: string;
  issuerName?: string;
}

/** A file found by any index scan, before it becomes a FileJob. */
export interface DiscoveredFile {
  url: string;
  sizeBytes?: number;
  /** "in-network-rates" | "allowed-amounts" | "table-of-contents" */
  fileType?: string;
  reportingEntity?: string;
  reportingEntityType?: string;
  /** The index (TOC) this reference came from. */
  indexUrl?: string;
  /**
   * Every plan the index lists for this file. A shared file is queued once
   * but must stay linked to all of them — see file-plans.ts.
   */
  plans?: FilePlan[];
  foundAt: Date;
}

/** Contract every scan type implements. */
export interface Scanner<P> {
  scan(payload: P): Promise<DiscoveredFile[]>;
}
