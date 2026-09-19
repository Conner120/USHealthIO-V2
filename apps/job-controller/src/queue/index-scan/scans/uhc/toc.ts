import type { UhcTocPayload } from "@repo/queue";
import type { Scanner, DiscoveredFile, FilePlan } from "../../types";

/** Shape of a UHC index JSON (CMS TiC table-of-contents schema). */
export interface UhcIndexJson {
  reporting_entity_name: string;
  reporting_entity_type: string;
  reporting_structure: Array<{
    reporting_plans?: Array<{
      plan_name: string;
      plan_id: string;
      plan_id_type: string;
      plan_market_type: string;
      plan_sponsor_name?: string;
      issuer_name?: string;
    }>;
    in_network_files?: Array<{ description?: string; location: string }>;
    allowed_amount_file?: { description?: string; location: string };
  }>;
  last_updated_on?: string;
  version?: string;
}

/**
 * Parses one UHC index JSON: reporting_structure[].in_network_files[] +
 * allowed_amount_file. Sizes are not in the index; the worker HEADs each URL.
 * Each file carries every reporting_plan of its structure entry; the same
 * URL can appear in several entries and is emitted once per entry.
 */
export const uhcTocScanner: Scanner<UhcTocPayload> = {
  async scan(payload): Promise<DiscoveredFile[]> {
    const res = await fetch(payload.url);
    if (!res.ok) throw new Error(`uhc-toc: ${payload.url} -> ${res.status}`);
    const index = (await res.json()) as UhcIndexJson;
    return filesFromIndex(index, payload.url, new Date());
  },
};

export function filesFromIndex(index: UhcIndexJson, indexUrl: string, foundAt: Date): DiscoveredFile[] {
  const out: DiscoveredFile[] = [];
  for (const rs of index.reporting_structure ?? []) {
    const plans: FilePlan[] = (rs.reporting_plans ?? []).map((p) => ({
      planName: p.plan_name,
      planId: p.plan_id,
      planIdType: p.plan_id_type,
      planMarketType: p.plan_market_type,
      planSponsorName: p.plan_sponsor_name,
      issuerName: p.issuer_name,
    }));
    const base = {
      reportingEntity: index.reporting_entity_name,
      reportingEntityType: index.reporting_entity_type,
      indexUrl,
      plans,
      foundAt,
    };
    for (const f of rs.in_network_files ?? []) {
      out.push({ url: f.location, fileType: "in-network-rates", ...base });
    }
    if (rs.allowed_amount_file) {
      out.push({ url: rs.allowed_amount_file.location, fileType: "allowed-amounts", ...base });
    }
  }
  return out;
}
