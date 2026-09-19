/** Size tiers for discovered MRF files. Each tier has its own file queue. */

const MB = 1024 * 1024;
const GB = 1024 * MB;

export const SIZE_TIERS = [
  { name: "xs", label: "< 250 MB", maxBytes: 250 * MB },
  { name: "sm", label: "< 1 GB", maxBytes: 1 * GB },
  { name: "md", label: "< 5 GB", maxBytes: 5 * GB },
  { name: "lg", label: "< 25 GB", maxBytes: 25 * GB },
  { name: "xl", label: ">= 25 GB", maxBytes: Infinity },
] as const;

export type SizeTier = (typeof SIZE_TIERS)[number]["name"];

export function tierFor(bytes: number): SizeTier {
  for (const t of SIZE_TIERS) if (bytes < t.maxBytes) return t.name;
  return "xl";
}
