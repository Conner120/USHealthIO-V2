CREATE KEYSPACE IF NOT EXISTS health_dev WITH replication = {'class': 'SimpleStrategy', 'replication_factor': '1'};
CREATE TABLE health_dev.procedure_rate (
    procedure_hash text PRIMARY KEY,
    negotiated_rate decimal,
    expiration_date date,
    billing_code text,
    service_code List<TinyInt>,
    billing_class TinyInt,
    setting TinyInt,
    billing_code_modifier List<Text>
);


CREATE TABLE health_dev.provider_active_procedure_rate (
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
-- create a index for the provider_group_id and insureance_plan_id
CREATE INDEX ON health_dev.provider_active_procedure_rate (provider_group_id);
CREATE INDEX ON health_dev.provider_active_procedure_rate (insurance_plan_id);

CREATE TABLE health_dev.provider_archived_procedure_rate (
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