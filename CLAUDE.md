# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Ushio-v2 is a distributed system for parsing and aggregating insurance Machine-Readable File (MRF) data. It ingests MRF files from insurance carriers, parses negotiated provider rates, and stores structured healthcare pricing data.

## Monorepo Structure

- **Turbo** monorepo with **Bun** (1.2.12) as the package manager
- Workspaces: `apps/*` and `packages/*`
- Rust parser binary lives outside workspaces in `parser-tools/parser-rs/`

## Build Commands

```bash
bun dev              # Start all services in dev/watch mode (turbo)
bun build            # Build all packages
bun lint             # ESLint across all packages
bun format           # Prettier (ts, tsx, md files)
bun check-types      # TypeScript type checking
bun generate         # Code generation (Prisma client, etc.)
```

### Database (packages/database)

**IMPORTANT: Never run `prisma migrate dev`, `prisma db push`, `prisma db execute`, or any command that modifies the database. Only edit `schema.prisma` — the user will run migrations themselves.**

```bash
cd packages/database
bunx prisma format          # Format schema file
bunx prisma validate        # Validate schema file
```

### Rust Parser (parser-tools/parser-rs)

```bash
cd parser-tools/parser-rs
cargo build --release    # Build release binary (output: target/release/main)
```

Protobuf codegen runs automatically via `build.rs` during cargo build.

## Architecture

### Data Flow

```
Admin UI → RabbitMQ job queue → HDAS → Rust Parser → ClickHouse   (SINK=clickhouse, default)
                                                   └→ RabbitMQ streams → HDSave   (SINK=rabbitmq, legacy)
```

1. **Admin** (`apps/admin/`) — Next.js 16 dashboard. Manages insurance companies, scan sources, procedure codes, and provider groups. Publishes MRF parsing jobs to RabbitMQ. Auth via WorkOS AuthKit.
2. **HDAS** (`apps/hdas/`) — Bun service. Consumes jobs from `hdas-jobs` RabbitMQ queue, orchestrates multi-step file parsing, invokes the Rust parser as a subprocess, tracks job status/progress in PostgreSQL.
3. **parser-rs** (`parser-tools/parser-rs/`) — Rust binary. mmaps the MRF file, a structural scanner (`scan.rs`) finds element byte ranges, and N worker tasks (`pipeline.rs`, default = all cores) parse them with serde_json (`model.rs`). Output sink is chosen by `SINK`: `clickhouse` (default; each worker streams RowBinary inserts, see `clickhouse-schema/schema.sql`), `rabbitmq` (legacy protobuf publisher to RabbitMQ streams), or `none`. All tuning is via env vars — see `parser-tools/parser-rs/.env.example`. ClickHouse inserts are sent as whole batches (opened, written and ended in one statement, never held open) and retried with exponential backoff — unlimited by default; `CLICKHOUSE_MAX_RETRIES` / `CLICKHOUSE_RETRY_ABORT_SECS` abort the job instead. `allowlist.rs` classifies each price as ALLOW/REVIEW/DENY (structural "zombie rate" rules on class × code type × code range × modifier); the verdict is stored in ClickHouse (`zombie_verdict`, `zombie_rule`) and `ZOMBIE_FILTER=off|deny|review` decides whether flagged rows are dropped. `cargo run --release --bin classify_codes -- <csv>` runs the same rules over a billing-codes CSV offline. Memory is meant to be flat in file size: scanned mmap pages are handed back to the kernel as the scan moves on (`PARSER_MMAP_RELEASE_MB`; Linux only — macOS ignores MADV_DONTNEED for file-backed maps), provider references stream to the sink instead of being buffered, and the rate-dedup set is capped (`PARSER_RATE_DEDUP_MAX`). The one structure that still scales is the file-local provider_group_id → TIN map that pass 2 resolves rates through.
4. **HDSave** (`apps/hdsave/`) — Bun service. Legacy consumer for the `SINK=rabbitmq` path: reads protobuf messages from RabbitMQ streams (`in_network_rates-{shardId}`). Not used when the parser writes to ClickHouse directly.

### Shared Packages

- `@repo/database` — Prisma client and schema (PostgreSQL). Exports from `./src/client.ts`.
- `@repo/id-gen` — Type-prefixed CUID2 ID generation (`ins_`, `iss_`, `ins_job_`, `ins_plan_`, `ins_file_`, `ins_step_`).
- `@repo/object-hash` — Plan deduplication hashing using Bun's native hash.
- `@repo/eslint-config` — Shared ESLint configs (`library.js`, `next.js`).
- `@repo/typescript-config` — Shared tsconfig (`base.json`, `nextjs.json`).

### Horizontal Scaling

Services use a `SHARD_ID` environment variable. Each shard gets its own RabbitMQ stream (`in_network_rates-{shardId}`) and Redis offset tracking.

### Message Serialization

Protobuf definitions are in `parser-tools/parser-rs/src/protos/kafka.proto`. The same `.proto` is compiled for both Rust (via `build.rs`) and TypeScript (via `pbjs`/`pbts` in `apps/hdsave/`).

## Key Infrastructure Dependencies

PostgreSQL, Redis, RabbitMQ (with streams plugin), Kafka (optional, parser can publish to either).

## Docker

Dockerfiles exist in `apps/hdas/Dockerfile` and `apps/hdsave/Dockerfile`. Both use `oven/bun:1.3` base. HDAS Dockerfile also builds the Rust parser. Images are published to `ghcr.io/conner120/` via GitHub Actions.

## ClickHouse Schema

`clickhouse-schema/schema.sql` (v2, content-addressed) defines the analytics tables. Entities are stored once and keyed by xxHash64 content hashes: `rates` (`rate_hash`, plus `billing_key_hash` = the pricing slot), `provider_groups` (`provider_group_hash` = TIN). Observations are "seen" rows: `rate_seen` (rate × TIN × job, the only big table), `provider_group_seen` (TIN × job with that file's NPIs), `provider_group_npi` MV, `rate_history` MV. `rate_validity` / `provider_validity` hold current supersede state (written by a post-scan pass, not the parser). `job_runs` is written by job-controller: one row per file job / management task with status, sizes, timings and that operation's console output. `mrf_files` is the per-job header; `mrf_file_plans` (written by job-controller) links files to plans. `in_network_rates` is a compatibility view. Apply with `bun apps/job-controller/scripts/apply-clickhouse-schema.ts` (targets `CLICKHOUSE_DATABASE`) or `clickhouse-client --multiquery < clickhouse-schema/schema.sql`. `schema.dbml` is the dbdiagram.io view; v1 is kept as `schema.v1.*`. Hash rules and SQL verification expressions are in the schema header; the parser side is `parser-rs/src/hashing.rs`.

## CQL Schema

`cql-schema/` contains Cassandra materialized views for analytics queries (by region, zip code, provider). This is separate from the primary PostgreSQL database.
