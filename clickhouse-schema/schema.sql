-- ClickHouse schema for MRF in-network rates written by parser-tools/parser-rs (SINK=clickhouse).
--
-- Apply with:  clickhouse-client --multiquery < clickhouse-schema/schema.sql
-- Database name must match CLICKHOUSE_DATABASE (default: health).
--
-- Design notes
--   * Normalized: `in_network_rates` has one row per negotiated price x provider_group_id and never
--     repeats provider data. `provider_groups` has one row per (provider_group_id, TIN) with NPIs as
--     an array. Join on (insurance_scan_job_id, provider_group_id).
--   * Append-only MergeTree. Every row is tagged with insurance_scan_job_id; a re-run of the same file
--     is a new job id. Clean up an old job with:
--       ALTER TABLE health.in_network_rates DELETE WHERE insurance_scan_job_id = '...';
--   * Monthly partitions by ingestion time keep part counts sane while allowing whole-month drops.
--   * LowCardinality on every enum-like column; ZSTD on free text; Delta+ZSTD on rates/dates.
--   * `ingested_at` uses DEFAULT now() — the parser omits it from the INSERT column list.

CREATE DATABASE IF NOT EXISTS health;

-- One row per parsed MRF file / job (the file header). ReplacingMergeTree so a re-run that reuses a
-- job id collapses to the latest row on merge (use FINAL or argMax when reading).
CREATE TABLE IF NOT EXISTS health.mrf_files
(
    insurance_scan_job_id    String,
    reporting_entity_name    String,
    reporting_entity_type    LowCardinality(String),
    issuer_name              String,
    plan_name                String,
    plan_id_type             LowCardinality(String),
    plan_id                  String,
    plan_sponsor_name        String,
    plan_market_type         LowCardinality(String),
    version                  LowCardinality(String),
    provider_reference_count UInt64,
    in_network_count         UInt64,
    rate_row_count           UInt64,
    ingested_at              DateTime DEFAULT now()
)
ENGINE = ReplacingMergeTree(ingested_at)
ORDER BY insurance_scan_job_id;

-- Provider groups referenced by rates. One row per (job, provider_group_id, TIN).
CREATE TABLE IF NOT EXISTS health.provider_groups
(
    insurance_scan_job_id String,
    provider_group_id     Int64,
    network_name          Array(LowCardinality(String)),
    tin_type              LowCardinality(String),        -- 'ein' | 'npi'
    tin_value             String,
    business_name         String CODEC(ZSTD(1)),
    npi                   Array(Int64),
    ingested_at           DateTime DEFAULT now(),

    INDEX idx_npi npi TYPE bloom_filter(0.01) GRANULARITY 4,
    INDEX idx_tin tin_value TYPE bloom_filter(0.01) GRANULARITY 4
)
ENGINE = MergeTree
PARTITION BY toYYYYMM(ingested_at)
ORDER BY (insurance_scan_job_id, provider_group_id, tin_value)
SETTINGS index_granularity = 8192;

-- Flattened NPI -> provider group lookup, maintained automatically from provider_groups inserts.
-- Use it to answer "which provider groups (and therefore rates) does NPI X belong to?".
CREATE TABLE IF NOT EXISTS health.provider_group_npi
(
    npi                   Int64,
    insurance_scan_job_id String,
    provider_group_id     Int64,
    tin_value             String
)
ENGINE = MergeTree
ORDER BY (npi, insurance_scan_job_id, provider_group_id);

CREATE MATERIALIZED VIEW IF NOT EXISTS health.provider_group_npi_mv
TO health.provider_group_npi AS
SELECT
    arrayJoin(npi)        AS npi,
    insurance_scan_job_id,
    provider_group_id,
    tin_value
FROM health.provider_groups;

-- Negotiated rates. One row per negotiated price x provider_group_id.
CREATE TABLE IF NOT EXISTS health.in_network_rates
(
    insurance_scan_job_id     String,
    provider_group_id         Int64,
    negotiation_arrangement   LowCardinality(String),    -- 'ffs' | 'bundle' | 'capitation'
    billing_code_type         LowCardinality(String),    -- 'CPT' | 'HCPCS' | 'MS-DRG' | ...
    billing_code_type_version LowCardinality(String),
    billing_code              LowCardinality(String),
    name                      LowCardinality(String),
    description               LowCardinality(String),
    severity_of_illness       LowCardinality(String),    -- '' when absent
    negotiated_type           LowCardinality(String),    -- 'negotiated' | 'derived' | 'fee schedule' | 'percentage' | 'per diem'
    negotiated_rate           Nullable(Float64) CODEC(Gorilla, ZSTD(1)),
    expiration_date           Nullable(Date32) CODEC(Delta(4), ZSTD(1)),  -- clamped to 2299-12-31 (Date32 max); carriers use 9999-12-31 for "never"
    service_code              Array(LowCardinality(String)),
    billing_class             LowCardinality(String),    -- 'professional' | 'institutional'
    setting                   LowCardinality(String),    -- '' when absent
    billing_code_modifier     Array(LowCardinality(String)),
    additional_information    Array(String) CODEC(ZSTD(1)),
    -- Structural "zombie rate" classification from parser-rs/src/allowlist.rs. Always populated;
    -- ZOMBIE_FILTER on the parser decides whether DENY/REVIEW rows are dropped before insert.
    zombie_verdict            LowCardinality(String) DEFAULT 'ALLOW',   -- 'ALLOW' | 'REVIEW' | 'DENY'
    zombie_rule               LowCardinality(String) DEFAULT 'ok',      -- rule id, e.g. 'mod.27_professional'
    ingested_at               DateTime DEFAULT now(),

    INDEX idx_rate negotiated_rate TYPE minmax GRANULARITY 4
)
ENGINE = MergeTree
PARTITION BY toYYYYMM(ingested_at)
ORDER BY (insurance_scan_job_id, billing_code_type, billing_code, provider_group_id)
SETTINGS index_granularity = 8192;

-- Migration for tables created before the zombie columns existed (idempotent):
ALTER TABLE health.in_network_rates
    ADD COLUMN IF NOT EXISTS zombie_verdict LowCardinality(String) DEFAULT 'ALLOW' AFTER additional_information,
    ADD COLUMN IF NOT EXISTS zombie_rule    LowCardinality(String) DEFAULT 'ok'    AFTER zombie_verdict;


