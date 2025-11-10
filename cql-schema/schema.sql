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
    provider_npi text,
    insurance_plan_id text,
    billing_code text,
    procedure_hash text,
    first_seen_date date,
    last_seen_date date,
    -- set partition key
    PRIMARY KEY ((provider_npi, insurance_plan_id), billing_code, procedure_hash)
);

