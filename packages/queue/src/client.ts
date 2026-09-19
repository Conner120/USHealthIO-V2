import Redis from "ioredis";

/**
 * One lazily-created Redis connection per process, from REDIS_URL.
 * ioredis works in both Bun and Node, so this is shared by every app.
 */
let client: Redis | null = null;

export function getRedis(): Redis {
  if (!client) {
    const url = process.env.REDIS_URL;
    if (!url) throw new Error("Missing required env var: REDIS_URL");
    client = new Redis(url, { lazyConnect: true, maxRetriesPerRequest: 2 });
  }
  return client;
}

/** Throws if Redis is unreachable. Call once at startup. */
export async function pingRedis(): Promise<void> {
  const pong = await getRedis().ping();
  if (pong !== "PONG") throw new Error(`Redis ping failed: ${pong}`);
}

export async function closeRedis(): Promise<void> {
  if (client) {
    await client.quit();
    client = null;
  }
}
