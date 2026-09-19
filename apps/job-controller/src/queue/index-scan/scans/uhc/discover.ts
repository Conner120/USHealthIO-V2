/**
 * Dry-run UHC discovery. Walks the blob listing -> every index JSON ->
 * dedupes the in-network / allowed-amount URLs they reference, then HEADs
 * each unique URL for its content-length. Prints, does not enqueue.
 *
 *   bun src/queue/index-scan/scans/uhc/discover.ts [--limit N] [--concurrency N] [--filter substr]
 */
import { uhcIndexPageScanner } from "./index-page";
import { uhcTocScanner } from "./toc";

interface SharedFile {
  url: string;
  fileType: string;
  refs: number; // how many index files reference it
  entities: Set<string>;
  sizeBytes?: number | null;
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (t: T, i: number) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]!, i);
    }
  });
  await Promise.all(workers);
  return out;
}

async function headContentLength(url: string, retries = 2): Promise<number | null> {
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await fetch(url, { method: "HEAD", redirect: "follow" });
      const len = res.headers.get("content-length");
      if (res.ok && len) return Number(len);
      if (attempt >= retries) return null;
    } catch {
      if (attempt >= retries) return null;
    }
    await Bun.sleep(250 * (attempt + 1));
  }
}

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? undefined : process.argv[i + 1];
}

const fmt = (n: number) => (n >= 1e9 ? `${(n / 1e9).toFixed(2)} GB` : n >= 1e6 ? `${(n / 1e6).toFixed(1)} MB` : `${(n / 1e3).toFixed(0)} KB`);

async function main() {
  const limit = Number(arg("limit") ?? Infinity);
  const concurrency = Number(arg("concurrency") ?? 32);
  const entityFilter = arg("filter");

  console.time("listing");
  const tocs = await uhcIndexPageScanner.scan({ carrier: "uhc", type: "uhc-index-page", entityFilter });
  console.timeEnd("listing");
  const toScan = tocs.slice(0, limit);
  console.log(`index files: ${tocs.length} (scanning ${toScan.length})`);

  // Walk every index JSON, aggregating referenced files by URL.
  const shared = new Map<string, SharedFile>();
  let done = 0;
  let failed = 0;
  console.time("tocs");
  await mapLimit(toScan, concurrency, async (toc) => {
    try {
      const files = await uhcTocScanner.scan({
        carrier: "uhc",
        type: "uhc-toc",
        url: toc.url,
        reportingEntity: toc.reportingEntity,
      });
      for (const f of files) {
        let s = shared.get(f.url);
        if (!s) shared.set(f.url, (s = { url: f.url, fileType: f.fileType ?? "unknown", refs: 0, entities: new Set() }));
        s.refs++;
        if (f.reportingEntity) s.entities.add(f.reportingEntity);
      }
    } catch (e) {
      failed++;
      if (failed <= 10) console.warn(`[toc] ${toc.url}: ${(e as Error).message}`);
    }
    if (++done % 2000 === 0) console.log(`  tocs ${done}/${toScan.length}, unique files ${shared.size}`);
  });
  console.timeEnd("tocs");
  console.log(`tocs scanned: ${done}, failed: ${failed}, unique files referenced: ${shared.size}`);

  // HEAD every unique file for its size.
  const files = [...shared.values()];
  let headed = 0;
  console.time("head");
  await mapLimit(files, concurrency, async (f) => {
    f.sizeBytes = await headContentLength(f.url);
    if (++headed % 500 === 0) console.log(`  head ${headed}/${files.length}`);
  });
  console.timeEnd("head");

  // Report.
  const byType = new Map<string, { count: number; bytes: number; noSize: number }>();
  for (const f of files) {
    const t = byType.get(f.fileType) ?? { count: 0, bytes: 0, noSize: 0 };
    t.count++;
    if (f.sizeBytes == null) t.noSize++;
    else t.bytes += f.sizeBytes;
    byType.set(f.fileType, t);
  }
  console.log("\n=== summary by file type ===");
  for (const [type, t] of byType) console.log(`${type}: ${t.count} files, ${fmt(t.bytes)} total, ${t.noSize} without size`);

  const inNetwork = files.filter((f) => f.fileType === "in-network-rates");
  const multiRef = inNetwork.filter((f) => f.refs > 1);
  console.log(`\nin-network files referenced by >1 index: ${multiRef.length} / ${inNetwork.length}`);

  console.log("\n=== top 30 in-network files by refs ===");
  for (const f of [...inNetwork].sort((a, b) => b.refs - a.refs).slice(0, 30)) {
    console.log(`${String(f.refs).padStart(6)} refs  ${f.sizeBytes == null ? "   ?   " : fmt(f.sizeBytes).padStart(10)}  ${f.url.split("/").pop()}`);
  }
  console.log("\n=== top 30 in-network files by size ===");
  for (const f of [...inNetwork].sort((a, b) => (b.sizeBytes ?? 0) - (a.sizeBytes ?? 0)).slice(0, 30)) {
    console.log(`${fmt(f.sizeBytes ?? 0).padStart(10)}  ${String(f.refs).padStart(6)} refs  ${f.url.split("/").pop()}`);
  }

  const outPath = arg("out");
  if (outPath) {
    await Bun.write(
      outPath,
      JSON.stringify(files.map((f) => ({ ...f, entities: f.entities.size })), null, 2),
    );
    console.log(`\nwrote ${outPath}`);
  }
}

await main();
