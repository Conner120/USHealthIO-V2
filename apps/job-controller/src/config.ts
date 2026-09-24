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
// Roles are independent: a node can run management tasks, file jobs, or both. FILE_NODE defaults
// to "whatever MANAGEMENT_NODE is not", which preserves the old either/or behaviour for existing
// .env files; set both to true to run management and file processing on one node.
const isManagement = bool("MANAGEMENT_NODE", false);
const isFile = bool("FILE_NODE", !isManagement);
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
        /** Runs the management task queues (index-scan, discovery, cleanup). */
        isManagement,
        /** Runs the tiered file queues (download -> decompress -> parse). */
        isFile,
        /** File role only: true = RAM disk staging, false = regular disk. */
        isRam,
        /** "management", "disk", "ram", or a combination like "management+disk". */
        get role(): string {
            const roles = [];
            if (isManagement) roles.push("management");
            if (isFile) roles.push(isRam ? "ram" : "disk");
            return roles.join("+") || "idle";
        },
    },
    management: {
        maxConcurrentTasks: Number(optional("MAX_CONCURRENT_TASKS", "4")),
        maxTaskAttempts: Number(optional("MAX_TASK_ATTEMPTS", "3")),
    },
    files: {
        /**
         * Hard cap on file jobs running at once on this node. The storage budget alone is not a
         * limit on parallelism — a 500 GB node would otherwise start thousands of small downloads
         * at once and finish none of them. Each running job is a download plus (eventually) a
         * parser process, so keep this near the core/bandwidth count.
         */
        maxConcurrent: Number(optional("MAX_CONCURRENT_FILES", "4")),
    },
    storage: {
        /** Bytes available for staging files (RAM_DISK_TOTAL or DISK_TOTAL by node type). */
        totalBytes,
        /**
         * Largest single file this node will take, compared against the *staging footprint*
         * (compressed size x expansionRatio), not the download size.
         */
        maxFileBytes: process.env.MAX_FILE_BYTES ? parseBytes(process.env.MAX_FILE_BYTES) : totalBytes,
        /** Assumed decompressed:compressed ratio for `.gz` etc. See queue/tic/footprint.ts. */
        expansionRatio: Number(optional("COMPRESSED_EXPANSION_RATIO", "15")),
        /** Directory files are downloaded and decompressed into. Cleared per job. */
        stagingDir: optional("STAGING_DIR", isRam ? "/dev/shm/mrf" : "/tmp/mrf"),
        /** Keep the staged files after a job finishes (debugging). */
        keepStaged: bool("KEEP_STAGED_FILES", false),
    },
    parser: {
        /** Path to the parser-rs release binary. */
        bin: optional("PARSER_BIN", "../../parser-tools/parser-rs/target/release/main"),
        /** Extra env passed through to the parser process (SINK, CLICKHOUSE_*, THREADS, ...). */
        passThroughEnv: optional(
            "PARSER_ENV_PASSTHROUGH",
            "SINK,CLICKHOUSE_URL,CLICKHOUSE_USER,CLICKHOUSE_PASSWORD,CLICKHOUSE_DATABASE,THREADS,QUEUE_DEPTH,ZOMBIE_FILTER,CLICKHOUSE_INSERT_MAX_ROWS,CLICKHOUSE_INSERT_MAX_BYTES,CLICKHOUSE_COMPRESSION,CLICKHOUSE_VALIDATE_SCHEMA",
        ).split(",").map((s) => s.trim()).filter(Boolean),
    },
    jobRecords: {
        /** Report every file job / management task to ClickHouse `job_runs`. */
        enabled: bool("JOB_RECORDS_ENABLED", true),
        table: optional("JOB_RECORDS_TABLE", "job_runs"),
        /** Console output kept per record (tail). 0 = do not store logs. */
        logMaxBytes: Number(optional("JOB_LOG_MAX_BYTES", String(256 * 1024))),
        flushMs: Number(optional("JOB_RECORDS_FLUSH_MS", "2000")),
    },
    log: {
        /** Per-operation console output, kept for the dashboard. Cleared at startup. */
        dir: optional("LOG_DIR", `${process.cwd()}/tmp/job-logs`),
        keepLines: Number(optional("LOG_KEEP_LINES", "500")),
        keepRuns: Number(optional("LOG_KEEP_RUNS", "200")),
    },
    web: {
        /** Serve the dashboard. WEB_PORT pins the port; unset = random free port + open a browser. */
        enabled: bool("WEB_ENABLED", true),
    },
    queue: {
        pollIntervalMs: Number(optional("POLL_INTERVAL_MS", "5000")),
        /** Force quit if a graceful shutdown takes longer than this. 0 = wait forever. */
        shutdownTimeoutMs: Number(optional("SHUTDOWN_TIMEOUT_MS", "30000")),
        // NODE_ID / HEARTBEAT_* / REAPER_INTERVAL_MS / MAX_JOB_ATTEMPTS are read by @repo/queue (settings.ts).
    },
} as const;
