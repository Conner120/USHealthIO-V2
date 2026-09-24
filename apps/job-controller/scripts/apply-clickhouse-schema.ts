/**
 * Apply clickhouse-schema/schema.sql to the database named in CLICKHOUSE_DATABASE
 * (rewriting `health.` / `health` in the file to that name). Idempotent — every
 * statement in the schema is IF NOT EXISTS / additive.
 *
 *   bun scripts/apply-clickhouse-schema.ts
 */
import { createClient } from "@clickhouse/client";
import { config } from "../src/config";

const db = config.clickhouse.database;
const quoted = `\`${db}\``;

// `health` is production and `health-dev` is shared; the script only ever CREATEs (never drops),
// but even that is not something to run against them by accident. Require --allow-prod.
const PROTECTED = new Set(["health", "health-dev"]);
if (PROTECTED.has(db) && !process.argv.includes("--allow-prod")) {
  console.error(`refusing to apply schema to protected database "${db}" (pass --allow-prod to override; use CLICKHOUSE_DATABASE=health-ai for test runs)`);
  process.exit(2);
}

const sql = (await Bun.file(new URL("../../../clickhouse-schema/schema.sql", import.meta.url)).text())
  .replace(/--.*$/gm, "")
  .replace(/\bhealth\./g, `${quoted}.`)
  .replace(/CREATE DATABASE IF NOT EXISTS health\b/g, `CREATE DATABASE IF NOT EXISTS ${quoted}`);

const statements = sql.split(";").map((s) => s.trim()).filter(Boolean);

// No database in the client: the first statement creates it.
const ch = createClient({ url: config.clickhouse.url, username: config.clickhouse.user, password: config.clickhouse.password });
for (const stmt of statements) {
  await ch.command({ query: stmt });
  console.log("ok:", stmt.split("\n")[0]!.slice(0, 90));
}
const tables = await (await ch.query({ query: `SHOW TABLES FROM ${quoted}`, format: "JSONEachRow" })).json<{ name: string }>();
console.log(`\n${db}:`, tables.map((t) => t.name).join(", "));
await ch.close();
