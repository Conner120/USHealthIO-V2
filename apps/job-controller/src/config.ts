/** Typed access to env. Bun loads .env automatically. */

function required(name: string): string {
    const v = process.env[name];
    if (!v) throw new Error(`Missing required env var: ${name}`);
    return v;
}

function optional(name: string, fallback: string): string {
    return process.env[name] ?? fallback;
}

function bool(name: string, fallback: boolean): boolean {
    const v = process.env[name];
    if (v === undefined) return fallback;
    return ["1", "true", "yes"].includes(v.toLowerCase());
}

/** Parses "512MB", "8GB", "1.5TB" or a plain byte count. */
export function parseBytes(input: string): number {
    const m = /^\s*([\d.]+)\s*([KMGT]?B?)\s*$/i.exec(input);
    if (!m) throw new Error(`Invalid byte size: ${input}`);
    const n = Number(m[1]);
    const unit = (m[2] ?? "").toUpperCase().replace("B", "");
    const mult = {"": 1, K: 1024, M: 1024 ** 2, G: 1024 ** 3, T: 1024 ** 4}[unit];
    if (mult === undefined) throw new Error(`Invalid byte size: ${input}`);
    return Math.floor(n * mult);
}

const isRam = bool("RAM_NODE", false);
const totalBytes = parseBytes(isRam ? optional("RAM_DISK_TOTAL", "8GB") : optional("DISK_TOTAL", "500GB"));

export const config = {
    clickhouse: {
        url: optional("CLICKHOUSE_URL", "http://localhost:8123"),
        user: optional("CLICKHOUSE_USER", "default"),
        password: optional("CLICKHOUSE_PASSWORD", ""),
        database: optional("CLICKHOUSE_DATABASE", "health"),
    },
    redis: {
        url: required("REDIS_URL"),
    },
    node: {
        /** true = runs non-file task queues instead of file queues. */
        isManagement: bool("MANAGEMENT_NODE", false),
        /** File nodes only: true = RAM disk node, false = regular disk node. */
        isRam,
    },
    management: {
        maxConcurrentTasks: Number(optional("MAX_CONCURRENT_TASKS", "4")),
        maxTaskAttempts: Number(optional("MAX_TASK_ATTEMPTS", "3")),
    },
    storage: {
        /** Bytes available for staging files (RAM_DISK_TOTAL or DISK_TOTAL by node type). */
        totalBytes,
        /** Largest single file this node will take. */
        maxFileBytes: process.env.MAX_FILE_BYTES ? parseBytes(process.env.MAX_FILE_BYTES) : totalBytes,
    },
    queue: {
        pollIntervalMs: Number(optional("POLL_INTERVAL_MS", "5000")),
        // NODE_ID / HEARTBEAT_* / REAPER_INTERVAL_MS / MAX_JOB_ATTEMPTS are read by @repo/queue (settings.ts).
    },
} as const;
