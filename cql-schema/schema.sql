CREATE TABLE health_dev.procedure_rate (
    procedure_hash text PRIMARY KEY,
    negotiated_rate decimal,
    expiration_date date,
    billing_code text,
    service_code List<TinyInt>,
    billing_class TinyInt,
    setting TinyInt,
    billing_code_modifier List<Text>,
    first_seen_date date,
    last_seen_date date
);


CREATE TABLE health_dev.provider_procedure_rate (
    provider_group_id text,
    zip_code smallint,
    region_code bigint,
    insurance_plan_id text,
    billing_code_id text,
    procedure_hash text,
    first_seen_date date,
    last_seen_date date,
    -- set partition key plan
    PRIMARY KEY ((insurance_plan_id, billing_code_id), provider_group_id, procedure_hash)
);

-- create materialized view for querying by region
CREATE MATERIALIZED VIEW health_dev.provider_procedure_rate_by_region AS
    SELECT * FROM health_dev.provider_procedure_rate
    WHERE region_code IS NOT NULL AND insurance_plan_id IS NOT NULL AND provider_group_id IS NOT NULL AND billing_code_id IS NOT NULL AND procedure_hash IS NOT NULL
    PRIMARY KEY ((region_code, billing_code_id), insurance_plan_id, provider_group_id, procedure_hash);

-- create materialized view for querying by zip code
CREATE MATERIALIZED VIEW health_dev.provider_procedure_rate_by_zip AS
    SELECT * FROM health_dev.provider_procedure_rate
    WHERE zip_code IS NOT NULL AND insurance_plan_id IS NOT NULL AND provider_group_id IS NOT NULL AND billing_code_id IS NOT NULL AND procedure_hash IS NOT NULL
    PRIMARY KEY ((zip_code, billing_code_id), insurance_plan_id, provider_group_id, procedure_hash);

-- create materialized view for querying by provider
CREATE MATERIALIZED VIEW health_dev.provider_procedure_rate_by_provider AS
    SELECT * FROM health_dev.provider_procedure_rate
    WHERE provider_group_id IS NOT NULL AND insurance_plan_id IS NOT NULL AND billing_code_id IS NOT NULL AND procedure_hash IS NOT NULL
    PRIMARY KEY ((provider_group_id), insurance_plan_id, billing_code_id, procedure_hash);
