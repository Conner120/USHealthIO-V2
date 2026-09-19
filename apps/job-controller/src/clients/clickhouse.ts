import { createClient, type ClickHouseClient } from "@clickhouse/client";
import { config } from "../config";

export const clickhouse: ClickHouseClient = createClient({
  url: config.clickhouse.url,
  username: config.clickhouse.user,
  password: config.clickhouse.password,
  database: config.clickhouse.database,
});

/** Throws if ClickHouse is unreachable. Call once at startup. */
export async function pingClickHouse(): Promise<void> {
  const res = await clickhouse.ping();
  if (!res.success) throw new Error(`ClickHouse ping failed: ${res.error}`);
}
