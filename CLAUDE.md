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

```bash
cd packages/database
bunx prisma migrate dev     # Create and apply migrations
bunx prisma migrate deploy  # Deploy migrations (production)
bunx prisma db push         # Push schema without migration
bunx prisma studio          # Open Prisma Studio GUI
bunx prisma format          # Format schema file
bunx tsx src/seed.ts         # Seed database
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
Admin UI → RabbitMQ job queue → HDAS → Rust Parser → RabbitMQ streams → HDSave → PostgreSQL
```

1. **Admin** (`apps/admin/`) — Next.js 16 dashboard. Manages insurance companies, scan sources, procedure codes, and provider groups. Publishes MRF parsing jobs to RabbitMQ. Auth via WorkOS AuthKit.
2. **HDAS** (`apps/hdas/`) — Bun service. Consumes jobs from `hdas-jobs` RabbitMQ queue, orchestrates multi-step file parsing, invokes the Rust parser as a subprocess, tracks job status/progress in PostgreSQL.
3. **parser-rs** (`parser-tools/parser-rs/`) — Rust binary. Streaming JSON parser (struson) for large MRF files. Publishes parsed negotiated rates as protobuf messages to RabbitMQ streams.
4. **HDSave** (`apps/hdsave/`) — Bun service. Consumes protobuf-encoded messages from RabbitMQ streams (`in_network_rates-{shardId}`), persists rate data. Uses Redis for stream offset tracking.

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

## CQL Schema

`cql-schema/` contains Cassandra materialized views for analytics queries (by region, zip code, provider). This is separate from the primary PostgreSQL database.
