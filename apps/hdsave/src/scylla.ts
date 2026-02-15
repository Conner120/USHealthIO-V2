import cassandra from "cassandra-driver";
import type { ResolvedRate } from "./types.ts";

const BATCH_CHUNK_SIZE = 50;

let client: cassandra.Client | null = null;

const SCYLLA_HOST = process.env.SCYLLA_HOST || "localhost";
const SCYLLA_DC = process.env.SCYLLA_DC || "datacenter1";
const SCYLLA_KEYSPACE = process.env.SCYLLA_KEYSPACE || "health_dev";

export function getScyllaClient(): cassandra.Client {
    if (!client) {
        client = new cassandra.Client({
            contactPoints: [SCYLLA_HOST],
            localDataCenter: SCYLLA_DC,
            keyspace: SCYLLA_KEYSPACE,
        });
    }
    return client;
}

export async function connectScylla(): Promise<void> {
    const c = getScyllaClient();
    await c.connect();
    console.log(`Connected to ScyllaDB at ${SCYLLA_HOST} (keyspace: ${SCYLLA_KEYSPACE})`);
}

export async function shutdownScylla(): Promise<void> {
    if (client) {
        await client.shutdown();
        client = null;
    }
}

const billingClassMap: Record<string, number> = {
    professional: 1,
    institutional: 2,
};

const settingMap: Record<string, number> = {
    inpatient: 1,
    outpatient: 2,
    both: 3,
};

function toBillingClassTinyInt(billingClass: string): number {
    return billingClassMap[billingClass.toLowerCase()] ?? 0;
}

function toSettingTinyInt(setting: string): number {
    return settingMap[setting.toLowerCase()] ?? 0;
}

function serviceCodeToTinyIntList(serviceCodes: string[]): number[] {
    return serviceCodes.map((s) => parseInt(s, 10) || 0);
}

const PROCEDURE_RATE_INSERT = `INSERT INTO procedure_rate (
    procedure_hash, negotiated_rate, expiration_date, billing_code,
    service_code, billing_class, setting, billing_code_modifier,
    first_seen_date, last_seen_date
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, toDate(now()), toDate(now()))`;

const PROVIDER_PROCEDURE_RATE_INSERT = `INSERT INTO provider_procedure_rate (
    insurance_plan_id, billing_code_id, provider_group_id, procedure_hash,
    first_seen_date, last_seen_date
) VALUES (?, ?, ?, ?, toDate(now()), toDate(now()))`;

export async function writeRatesToScylla(rates: ResolvedRate[]): Promise<void> {
    const c = getScyllaClient();

    // Build all individual queries
    const queries: { query: string; params: unknown[] }[] = [];

    for (const rate of rates) {
        const expirationDate = rate.expirationDate
            ? cassandra.types.LocalDate.fromString(rate.expirationDate)
            : null;

        queries.push({
            query: PROCEDURE_RATE_INSERT,
            params: [
                rate.procedureHash,
                rate.negotiatedRate,
                expirationDate,
                rate.billingCode,
                serviceCodeToTinyIntList(rate.serviceCode),
                toBillingClassTinyInt(rate.billingClass),
                toSettingTinyInt(rate.setting),
                rate.billingCodeModifier,
            ],
        });

        // Fan out to each insurance plan
        for (const planId of rate.insurancePlanIds) {
            queries.push({
                query: PROVIDER_PROCEDURE_RATE_INSERT,
                params: [
                    planId,
                    rate.billingCode,
                    rate.providerGroupId,
                    rate.procedureHash,
                ],
            });
        }
    }

    // Execute in unlogged batch chunks
    for (let i = 0; i < queries.length; i += BATCH_CHUNK_SIZE) {
        const chunk = queries.slice(i, i + BATCH_CHUNK_SIZE);
        await c.batch(chunk, { prepare: true, logged: false });
    }
}
