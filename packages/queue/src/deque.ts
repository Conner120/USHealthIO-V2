import { getRedis } from "./client";
import { decode, encode } from "./codec";

/**
 * A Redis list used as a deque of JSON payloads.
 * Head = index 0 = where workers pop. Tail = where new work is appended.
 */

export async function pushBack<T>(key: string, item: T): Promise<void> {
  await getRedis().rpush(key, encode(item));
}

export async function pushFront<T>(key: string, item: T): Promise<void> {
  await getRedis().lpush(key, encode(item));
}

export async function popFront<T>(key: string): Promise<T | null> {
  const raw = await getRedis().lpop(key);
  return raw == null ? null : decode<T>(raw);
}

export async function peekFront<T>(key: string): Promise<T | null> {
  const raw = await getRedis().lindex(key, 0);
  return raw == null ? null : decode<T>(raw);
}

export async function length(key: string): Promise<number> {
  return getRedis().llen(key);
}

export async function clear(key: string): Promise<void> {
  await getRedis().del(key);
}

/** Read a slice without removing (for status / inspection). */
export async function range<T>(key: string, start = 0, stop = -1): Promise<T[]> {
  const raws = await getRedis().lrange(key, start, stop);
  return raws.map((r) => decode<T>(r));
}
