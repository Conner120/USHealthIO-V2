-- ClickHouse schema (v2) for MRF in-network rates written by parser-tools/parser-rs (SINK=clickhouse)
-- and apps/job-controller (discovery).
--
-- Apply with:  bun apps/job-controller/scripts/apply-clickhouse-schema.ts   (uses CLICKHOUSE_DATABASE)
--         or:  clickhouse-client --multiquery < clickhouse-schema/schema.sql  (database: health)
--
-- Design (v2: content-addressed rates + "seen" records)
--   * A negotiated price is a *fact about the world*, not about a file. The same price appears in
--     thousands of files (UHC shares one network file across ~80k plans) and again every month.
--     v1 stored a row per (file, price, provider group): ~60 TB of MRF per month became billions
--     of mostly-identical rows. v2 stores each distinct price once (`rates`, keyed by rate_hash)
--     and each distinct provider group once (`provider_groups`, keyed by provider_group_hash = TIN), and
--     records every observation of a (rate, provider group) pair in `rate_seen`. Rows are tagged
--     with insurance_scan_job_id (= FileJob.id = parser <job_id>), so a re-run is a new job id.
--   * History falls out of the seen records: first_seen / last_seen / months seen per
--     (rate, provider group) is maintained by the `rate_history` materialized view, and a rate that
--     stops appearing simply stops getting seen rows. Nothing is ever updated or deleted.
--   * Hashes are xxHash64 over a canonical string (see below). They are computed by the parser
--     and are reproducible in SQL with xxHash64(...), so any row can be verified.
--   * Entity tables (`rates`, `provider_groups`) keep first_ingested_at (min) and last_ingested_at
--     (max) across re-sightings; seen tables keep a plain ingested_at per row.
--   * Time-varying attributes (expiration_date, network_name, NPI membership, the file's local
--     provider_group_id) live on the seen records, not on the hashed entities, so they don't
--     fragment the hash space — and so NPIs joining/leaving a TIN is itself tracked over time.
--   * LowCardinality on every enum-like column; ZSTD on free text; Delta/Gorilla on numbers.
--
-- Canonical hash inputs (fields joined with '|', arrays sorted and joined with ',', NULL -> ''):
--   rate_hash           = xxHash64(billing_code_type|billing_code_type_version|billing_code|
--                                  negotiation_arrangement|negotiated_type|negotiated_rate(as %.4f)|
--                                  billing_class|setting|severity_of_illness|
--                                  service_code[]|billing_code_modifier[]|additional_information[])
--   provider_group_hash = xxHash64(tin_type|tin_value)
--   billing_key_hash    = xxHash64(billing_code_type|billing_code_type_version|billing_code|
--                                  billing_class|setting|severity_of_illness|billing_code_modifier[])
--   name/description are NOT part of rate_hash (they are per-code labels that carriers word
--   differently); the latest wording is kept on `rates` (anyLast).
--
-- Validity (supersede)
--   billing_key_hash identifies a pricing *slot*: what a provider is paid for a code, in a class /
--   setting / severity, with these modifiers. Everything else on the rate — negotiated_rate,
--   negotiated_type, negotiation_arrangement, service_code[], additional_information[] — is
--   *price or terms*. Two rates with the same billing_key_hash and different rate_hash are the same
--   slot repriced or re-termed. After a scan, for each (reporting entity, provider group, slot) the
--   rate seen in the newest publication becomes `active` in rate_validity and any different rate
--   previously active for that slot becomes `superseded` (valid_to = the new rate's seen_on,
--   superseded_by = the new rate_hash). The pass is run by the job-controller (via the parser
--   runtime) after a scan job completes — out of scope here; a reference query is at the bottom.
--   `withdrawn` (slot / provider no longer published at all) is reserved for a later pass that runs
--   once an entire carrier has been scanned; nothing writes it yet.

CREATE DATABASE IF NOT EXISTS health;

-- ═══════════════════════════════════════════════════════════════════════════════════════════════
-- Discovery (apps/job-controller)
-- ═══════════════════════════════════════════════════════════════════════════════════════════════

-- Which plans an MRF file applies to. One row per (file, plan) reference, written at discovery
-- for EVERY index (TOC) that references the file — a shared file is queued once but linked to all
-- of its plans. Join to parsed data via file_job_id = insurance_scan_job_id.
CREATE TABLE IF NOT EXISTS health.mrf_file_plans
(
    file_url              String,
    file_job_id           String,                       -- FileJob.id; '' if the file was never queued (e.g. no size)
    file_type             LowCardinality(String),       -- 'in-network-rates' | 'allowed-amounts'
    index_url             String,                       -- the TOC this reference came from
    reporting_entity_name String,
    reporting_entity_type LowCardinality(String),
    plan_name             String,
    plan_id_type          LowCardinality(String),       -- 'EIN' | 'HIOS'
    plan_id               String,
    plan_market_type      LowCardinality(String),       -- 'group' | 'individual'
    plan_sponsor_name     String,
    issuer_name           String,
    discovered_at         DateTime,

    INDEX idx_job  file_job_id TYPE bloom_filter(0.01) GRANULARITY 4,
    INDEX idx_plan plan_id     TYPE bloom_filter(0.01) GRANULARITY 4
)
ENGINE = ReplacingMergeTree(discovered_at)
ORDER BY (file_url, reporting_entity_name, plan_id, plan_name);

-- ═══════════════════════════════════════════════════════════════════════════════════════════════
-- Parsed output (parser-rs)
-- ═══════════════════════════════════════════════════════════════════════════════════════════════

-- One row per parsed file / job: header fields + counts. The file's plan linkage is in
-- mrf_file_plans; only what the file header itself says is kept here.
CREATE TABLE IF NOT EXISTS health.mrf_files
(
    insurance_scan_job_id    String,
    file_url                 String,                    -- '' for legacy jobs
    reporting_entity_name    String,
    reporting_entity_type    LowCardinality(String),
    last_updated_on          Date,                      -- the file's own publication date; drives seen_on below
    version                  LowCardinality(String),
    provider_reference_count UInt64,
    in_network_count         UInt64,
    rate_row_count           UInt64,                    -- rate_seen rows written for this job
    distinct_rate_count      UInt64,                    -- distinct rate_hash in this job
    ingested_at              DateTime DEFAULT now()
)
ENGINE = ReplacingMergeTree(ingested_at)
ORDER BY insurance_scan_job_id;

-- Distinct negotiated prices, content-addressed. The parser inserts one row per distinct
-- rate_hash per job; AggregatingMergeTree collapses re-sightings into one row per hash while
-- keeping first_ingested_at = the FIRST time we ever saw the price (min) and last_ingested_at =
-- the most recent (max). Content columns are `any` (identical for a given hash by construction);
-- labels are `anyLast` so the latest wording wins. Read with FINAL, or GROUP BY rate_hash with
-- the matching aggregates when merges may be pending.
CREATE TABLE IF NOT EXISTS health.rates
(
    rate_hash                 UInt64,                   -- xxHash64, see header
    billing_key_hash          SimpleAggregateFunction(any, UInt64),                   -- the pricing slot this rate fills, see header
    billing_code_type         SimpleAggregateFunction(any, LowCardinality(String)),   -- 'CPT' | 'HCPCS' | 'MS-DRG' | 'RC' | ...
    billing_code_type_version SimpleAggregateFunction(any, LowCardinality(String)),
    billing_code              SimpleAggregateFunction(any, LowCardinality(String)),
    negotiation_arrangement   SimpleAggregateFunction(any, LowCardinality(String)),   -- 'ffs' | 'bundle' | 'capitation'
    negotiated_type           SimpleAggregateFunction(any, LowCardinality(String)),   -- 'negotiated' | 'derived' | 'fee schedule' | 'percentage' | 'per diem'
    negotiated_rate           SimpleAggregateFunction(any, Nullable(Float64)) CODEC(Gorilla, ZSTD(1)),
    billing_class             SimpleAggregateFunction(any, LowCardinality(String)),   -- 'professional' | 'institutional'
    setting                   SimpleAggregateFunction(any, LowCardinality(String)),   -- '' when absent
    severity_of_illness       SimpleAggregateFunction(any, LowCardinality(String)),   -- '' when absent
    service_code              SimpleAggregateFunction(any, Array(String)),   -- LowCardinality not allowed inside an aggregated array
    billing_code_modifier     SimpleAggregateFunction(any, Array(String)),
    additional_information    SimpleAggregateFunction(any, Array(String)) CODEC(ZSTD(1)),
    -- Labels: not hashed, latest wording wins.
    name                      SimpleAggregateFunction(anyLast, LowCardinality(String)),
    description               SimpleAggregateFunction(anyLast, LowCardinality(String)),
    -- Structural "zombie rate" classification (parser-rs/src/allowlist.rs). A property of the
    -- price's shape, so it is stable per hash. ZOMBIE_FILTER decides whether REVIEW/DENY are kept.
    zombie_verdict            SimpleAggregateFunction(anyLast, LowCardinality(String)),  -- 'ALLOW' | 'REVIEW' | 'DENY'
    zombie_rule               SimpleAggregateFunction(anyLast, LowCardinality(String)),
    first_ingested_at         SimpleAggregateFunction(min, DateTime),   -- first time this price was ever ingested
    last_ingested_at          SimpleAggregateFunction(max, DateTime),   -- most recent ingestion that carried it

    INDEX idx_code (billing_code_type, billing_code) TYPE bloom_filter(0.01) GRANULARITY 4,
    INDEX idx_slot billing_key_hash TYPE bloom_filter(0.01) GRANULARITY 4,
    INDEX idx_rate negotiated_rate TYPE minmax GRANULARITY 4
)
ENGINE = AggregatingMergeTree
ORDER BY rate_hash;

-- Distinct provider groups, content-addressed by TIN. NPI membership, the file-local
-- provider_group_id and the per-file network_name are time-varying and live on provider_group_seen.
-- Same first/last ingestion semantics as `rates`.
CREATE TABLE IF NOT EXISTS health.provider_groups
(
    provider_group_hash UInt64,                                            -- xxHash64(tin_type|tin_value)
    tin_type            SimpleAggregateFunction(any, LowCardinality(String)),  -- 'ein' | 'npi'
    tin_value           SimpleAggregateFunction(any, String),
    business_name       SimpleAggregateFunction(anyLast, String) CODEC(ZSTD(1)),  -- not hashed; latest wins
    first_ingested_at   SimpleAggregateFunction(min, DateTime),
    last_ingested_at    SimpleAggregateFunction(max, DateTime),

    INDEX idx_tin tin_value TYPE bloom_filter(0.01) GRANULARITY 4
)
ENGINE = AggregatingMergeTree
ORDER BY provider_group_hash;

-- ── Seen records ──────────────────────────────────────────────────────────────────────────────

-- A provider group appeared in a file, with these NPIs. Carries the file-local id (what the file's
-- rates refer to) and the network names the file listed for it. One row per (job, group).
-- NPI membership is time-varying: diff npi[] across seen_on to see providers join/leave a TIN.
CREATE TABLE IF NOT EXISTS health.provider_group_seen
(
    provider_group_hash   UInt64,
    insurance_scan_job_id String,
    provider_group_id     Int64,                        -- id local to that file
    npi                   Array(Int64),                 -- sorted ascending
    network_name          Array(LowCardinality(String)),
    seen_on               Date,                         -- mrf_files.last_updated_on
    ingested_at           DateTime DEFAULT now()
)
ENGINE = MergeTree
PARTITION BY toYYYYMM(seen_on)
ORDER BY (provider_group_hash, seen_on, insurance_scan_job_id);

-- NPI -> (provider group, when). Maintained by the MV below; never written directly.
-- min/max(seen_on) per (npi, provider_group_hash) gives an NPI's tenure under a TIN.
CREATE TABLE IF NOT EXISTS health.provider_group_npi
(
    npi                   Int64,
    provider_group_hash   UInt64,
    seen_on               Date,
    insurance_scan_job_id String
)
ENGINE = MergeTree
PARTITION BY toYYYYMM(seen_on)
ORDER BY (npi, provider_group_hash, seen_on, insurance_scan_job_id);

CREATE MATERIALIZED VIEW IF NOT EXISTS health.provider_group_npi_mv
TO health.provider_group_npi AS
SELECT arrayJoin(npi) AS npi, provider_group_hash, seen_on, insurance_scan_job_id
FROM health.provider_group_seen;

-- THE fact table: rate R was offered to provider group P, in file/job J, published on D, with
-- expiration E. One row per (job, rate, group). This is the only table that grows with volume,
-- and each row is 8+8+~40+4+4 bytes instead of a full rate row.
CREATE TABLE IF NOT EXISTS health.rate_seen
(
    rate_hash             UInt64,
    billing_key_hash      UInt64,                       -- denormalised from rates so the supersede pass is a self-join
    provider_group_hash   UInt64,
    insurance_scan_job_id String,
    seen_on               Date,                         -- mrf_files.last_updated_on (the publication month)
    expiration_date       Nullable(Date32) CODEC(Delta(4), ZSTD(1)),  -- clamped to 2299-12-31; 9999-12-31 = "never"
    ingested_at           DateTime DEFAULT now(),

    INDEX idx_job insurance_scan_job_id TYPE bloom_filter(0.01) GRANULARITY 4,

    -- Same data ordered by provider first, for "everything this group is paid" queries.
    PROJECTION by_provider
    (
        SELECT rate_hash, billing_key_hash, provider_group_hash, insurance_scan_job_id, seen_on, expiration_date
        ORDER BY (provider_group_hash, billing_key_hash, seen_on)
    )
)
ENGINE = MergeTree
PARTITION BY toYYYYMM(seen_on)
ORDER BY (rate_hash, provider_group_hash, seen_on, insurance_scan_job_id)
SETTINGS index_granularity = 8192;

-- ── History ───────────────────────────────────────────────────────────────────────────────────

-- Rolled-up lifetime of each (rate, provider group) pair: when it first/last appeared and in how
-- many publications. Maintained incrementally from rate_seen; read with -Merge or FINAL:
--   SELECT rate_hash, provider_group_hash, min(first_seen), max(last_seen), sum(times_seen)
--   FROM health.rate_history GROUP BY rate_hash, provider_group_hash
-- A rate whose last_seen falls behind the current month has been withdrawn or repriced.
CREATE TABLE IF NOT EXISTS health.rate_history
(
    rate_hash           UInt64,
    provider_group_hash UInt64,
    first_seen          SimpleAggregateFunction(min, Date),
    last_seen           SimpleAggregateFunction(max, Date),
    times_seen          SimpleAggregateFunction(sum, UInt64),
    last_expiration     SimpleAggregateFunction(max, Nullable(Date32))
)
ENGINE = AggregatingMergeTree
ORDER BY (rate_hash, provider_group_hash);

CREATE MATERIALIZED VIEW IF NOT EXISTS health.rate_history_mv
TO health.rate_history AS
SELECT
    rate_hash,
    provider_group_hash,
    min(seen_on)         AS first_seen,
    max(seen_on)         AS last_seen,
    count()              AS times_seen,
    max(expiration_date) AS last_expiration
FROM health.rate_seen
GROUP BY rate_hash, provider_group_hash;

-- ── Validity (current state) ──────────────────────────────────────────────────────────────────

-- Current rate for each pricing slot at each provider, per reporting entity. One row per
-- (reporting entity, provider group, slot); ReplacingMergeTree keeps the newest `as_of`.
--   active      the rate seen in the latest publication for this slot
--   superseded  a different rate for the same slot was seen later (see superseded_by)
--   withdrawn   reserved: slot no longer published by the entity (not written yet)
-- Written only by the post-scan pass; never by the parser. Read with FINAL.
CREATE TABLE IF NOT EXISTS health.rate_validity
(
    reporting_entity_name String,
    provider_group_hash   UInt64,
    billing_key_hash      UInt64,
    rate_hash             UInt64,
    status                LowCardinality(String),       -- 'active' | 'superseded' | 'withdrawn'
    valid_from            Date,                         -- seen_on of the publication that introduced this rate for the slot
    valid_to              Nullable(Date),               -- seen_on of the publication that replaced it; NULL while active
    superseded_by         UInt64 DEFAULT 0,             -- rate_hash that replaced it; 0 while active
    as_of_scan_job_id     String,                       -- top-level scan job that produced this row
    as_of                 DateTime DEFAULT now(),

    INDEX idx_rate   rate_hash     TYPE bloom_filter(0.01) GRANULARITY 4,
    INDEX idx_status status        TYPE set(3) GRANULARITY 4
)
ENGINE = ReplacingMergeTree(as_of)
ORDER BY (reporting_entity_name, provider_group_hash, billing_key_hash);

-- Whether a provider group is currently published by a reporting entity. One row per
-- (reporting entity, provider group). `withdrawn` reserved for the carrier-wide pass.
CREATE TABLE IF NOT EXISTS health.provider_validity
(
    reporting_entity_name String,
    provider_group_hash   UInt64,
    status                LowCardinality(String),       -- 'active' | 'withdrawn'
    valid_from            Date,                         -- first seen_on for this entity
    last_seen_on          Date,                         -- newest seen_on for this entity
    valid_to              Nullable(Date),               -- NULL while active
    as_of_scan_job_id     String,
    as_of                 DateTime DEFAULT now()
)
ENGINE = ReplacingMergeTree(as_of)
ORDER BY (reporting_entity_name, provider_group_hash);

-- Reference supersede pass for one completed scan job (for the runtime that will own it).
-- For every slot touched by the scan: the newest observation wins; anything previously active
-- for the slot with a different rate_hash is closed out.
--
--   WITH scan AS (SELECT insurance_scan_job_id, reporting_entity_name, last_updated_on
--                 FROM health.mrf_files FINAL WHERE insurance_scan_job_id IN (<jobs of scan>)),
--        newest AS (
--          SELECT f.reporting_entity_name, s.provider_group_hash, s.billing_key_hash,
--                 argMax(s.rate_hash, s.seen_on) AS rate_hash, max(s.seen_on) AS seen_on
--          FROM health.rate_seen s JOIN scan f USING (insurance_scan_job_id)
--          GROUP BY 1, 2, 3)
--   INSERT INTO health.rate_validity
--     -- close out the old rate
--     SELECT v.reporting_entity_name, v.provider_group_hash, v.billing_key_hash, v.rate_hash,
--            'superseded', v.valid_from, n.seen_on, n.rate_hash, '<scan job>', now()
--     FROM health.rate_validity v FINAL
--     JOIN newest n USING (reporting_entity_name, provider_group_hash, billing_key_hash)
--     WHERE v.status = 'active' AND v.rate_hash != n.rate_hash
--   UNION ALL
--     -- and make the new one active (valid_from = first time THIS rate was seen for the slot)
--     SELECT n.reporting_entity_name, n.provider_group_hash, n.billing_key_hash, n.rate_hash,
--            'active', min(s.seen_on), NULL, 0, '<scan job>', now()
--     FROM newest n JOIN health.rate_seen s
--       ON s.rate_hash = n.rate_hash AND s.provider_group_hash = n.provider_group_hash
--     GROUP BY 1, 2, 3, 4;
--
-- Note the ReplacingMergeTree key: the superseded row and the new active row have the same
-- (entity, provider, slot) key, so only the newest `as_of` — the active one — survives merges.
-- If you need to *read* superseded rows later, query rate_seen / rate_history instead; the
-- validity table is deliberately current-state only.

-- ── Convenience view ──────────────────────────────────────────────────────────────────────────

-- The v1 shape, for queries that want one wide row per observation.
CREATE VIEW IF NOT EXISTS health.in_network_rates AS
SELECT
    s.insurance_scan_job_id,
    s.seen_on,
    s.expiration_date,
    s.rate_hash,
    s.billing_key_hash,
    s.provider_group_hash,
    r.billing_code_type, r.billing_code_type_version, r.billing_code, r.name, r.description,
    r.negotiation_arrangement, r.negotiated_type, r.negotiated_rate,
    r.billing_class, r.setting, r.severity_of_illness,
    r.service_code, r.billing_code_modifier, r.additional_information,
    r.zombie_verdict, r.zombie_rule,
    p.tin_type, p.tin_value, p.business_name,
    g.provider_group_id, g.npi, g.network_name
FROM health.rate_seen AS s
INNER JOIN health.rates           FINAL AS r ON r.rate_hash = s.rate_hash
INNER JOIN health.provider_groups FINAL AS p ON p.provider_group_hash = s.provider_group_hash
INNER JOIN health.provider_group_seen AS g
    ON g.provider_group_hash = s.provider_group_hash AND g.insurance_scan_job_id = s.insurance_scan_job_id;
