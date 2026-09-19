import { test, expect } from "bun:test";
import { filesFromIndex, type UhcIndexJson } from "./toc";
import { filePlanRows } from "../../file-plans";

const index: UhcIndexJson = {
  reporting_entity_name: "United-HealthCare-Services-Inc",
  reporting_entity_type: "Third-Party Administrator",
  reporting_structure: [
    {
      reporting_plans: [
        { plan_name: "EPO", plan_id: "111", plan_id_type: "EIN", plan_market_type: "group", plan_sponsor_name: "ACME", issuer_name: "ACME" },
        { plan_name: "PPO", plan_id: "111", plan_id_type: "EIN", plan_market_type: "group", plan_sponsor_name: "ACME", issuer_name: "ACME" },
      ],
      in_network_files: [{ location: "https://x/shared.json.gz" }, { location: "https://x/only-a.json.gz" }],
      allowed_amount_file: { location: "https://x/allowed.json.gz" },
    },
    {
      reporting_plans: [{ plan_name: "HMO", plan_id: "222", plan_id_type: "EIN", plan_market_type: "group" }],
      in_network_files: [{ location: "https://x/shared.json.gz" }],
    },
  ],
};

test("every file carries all plans of its structure entry; shared url emitted per entry", () => {
  const files = filesFromIndex(index, "https://x/idx.json", new Date("2026-09-01T00:00:00Z"));
  expect(files.map((f) => [f.url, f.fileType, f.plans!.map((p) => p.planName)])).toEqual([
    ["https://x/shared.json.gz", "in-network-rates", ["EPO", "PPO"]],
    ["https://x/only-a.json.gz", "in-network-rates", ["EPO", "PPO"]],
    ["https://x/allowed.json.gz", "allowed-amounts", ["EPO", "PPO"]],
    ["https://x/shared.json.gz", "in-network-rates", ["HMO"]],
  ]);
  expect(files[0]).toMatchObject({ reportingEntity: "United-HealthCare-Services-Inc", reportingEntityType: "Third-Party Administrator", indexUrl: "https://x/idx.json" });
});

test("filePlanRows: one ClickHouse row per (file, plan)", () => {
  const [shared] = filesFromIndex(index, "https://x/idx.json", new Date("2026-09-01T00:00:00Z"));
  const rows = filePlanRows(shared!, "job-1");
  expect(rows).toHaveLength(2);
  expect(rows[0]).toEqual({
    file_url: "https://x/shared.json.gz",
    file_job_id: "job-1",
    file_type: "in-network-rates",
    index_url: "https://x/idx.json",
    reporting_entity_name: "United-HealthCare-Services-Inc",
    reporting_entity_type: "Third-Party Administrator",
    plan_name: "EPO",
    plan_id_type: "EIN",
    plan_id: "111",
    plan_market_type: "group",
    plan_sponsor_name: "ACME",
    issuer_name: "ACME",
    discovered_at: "2026-09-01 00:00:00",
  });
  expect(filePlanRows(shared!, "")[0]!.file_job_id).toBe("");
});
