/**
 * Send a UnitedHealthcare index-scan test job.
 *
 *   bun scripts/send.ts uhc                  # scan the full UHC blob listing
 *   bun scripts/send.ts uhc <entityFilter>   # only index files whose name contains this
 *   bun scripts/send.ts uhc <listing url>    # scan a different blob listing URL
 *   bun scripts/send.ts uhc-toc <url>        # scan one UHC index JSON
 *
 * Every run is scoped by one top-level job id (dedupe, url->job map, plan
 * links): pass --scan-job <id> to use an existing InsuranceScanJob id,
 * otherwise a fresh one is generated and printed.
 */
import { closeRedis, enqueueTask, pingRedis } from "@repo/queue";

const argv = process.argv.slice(2);
const sj = argv.indexOf("--scan-job");
const scanJobId = sj === -1 ? crypto.randomUUID() : argv[sj + 1]!;
if (sj !== -1) argv.splice(sj, 2);
console.log("scan job id:", scanJobId);
const [cmd, arg] = argv;

await pingRedis();

switch (cmd) {
  case "uhc": {
    const isUrl = arg?.startsWith("http");
    const payload = { carrier: "uhc" as const, type: "uhc-index-page" as const, ...(isUrl ? { url: arg } : arg ? { entityFilter: arg } : {}) };
    console.log("sent", await enqueueTask("index-scan", payload, { scanJobId }));
    break;
  }
  case "uhc-toc":
    if (!arg) {
      console.error("usage: bun scripts/send.ts uhc-toc <url>");
      process.exit(1);
    }
    console.log("sent", await enqueueTask("index-scan", { carrier: "uhc", type: "uhc-toc", url: arg }, { scanJobId }));
    break;
  default:
    console.error("usage: bun scripts/send.ts uhc [entityFilter] | uhc-toc <url>");
    process.exit(1);
}

await closeRedis();
