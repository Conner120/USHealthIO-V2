import { prisma } from "@repo/database";
import type { JobCache } from "./types.ts";
import { getJobContext } from "./job-context.ts";
import {
    procedureCodeHash,
    providerGroupHash,
    providerHash,
    providerGroupProviderHash,
} from "./hash.ts";

const jobCaches = new Map<string, JobCache>();

const EVICTION_INTERVAL_MS = 60_000;
const IDLE_TIMEOUT_MS = 5 * 60_000;

let evictionTimer: ReturnType<typeof setInterval> | null = null;

export function startCacheEviction() {
    evictionTimer = setInterval(() => {
        const now = Date.now();
        for (const [jobId, cache] of jobCaches) {
            if (now - cache.lastMessageAt > IDLE_TIMEOUT_MS) {
                jobCaches.delete(jobId);
                console.log(`Evicted cache for job ${jobId} (idle ${Math.round((now - cache.lastMessageAt) / 1000)}s)`);
            }
        }
    }, EVICTION_INTERVAL_MS);
}

export function stopCacheEviction() {
    if (evictionTimer) {
        clearInterval(evictionTimer);
        evictionTimer = null;
    }
}

export async function getOrCreateJobCache(insuranceScanJobId: string): Promise<JobCache> {
    const existing = jobCaches.get(insuranceScanJobId);
    if (existing) {
        existing.lastMessageAt = Date.now();
        return existing;
    }

    const context = await getJobContext(insuranceScanJobId);
    const cache: JobCache = {
        procedureCodes: new Map(),
        providerGroups: new Map(),
        providers: new Map(),
        providerGroupProviders: new Map(),
        insurancePlanIds: context.insurancePlanIds,
        insuranceCarrierId: context.insuranceCarrierId,
        lastMessageAt: Date.now(),
    };

    // Bulk-load procedure codes
    const allProcedureCodes = await prisma.procedure_code.findMany({
        select: { id: true, code: true, typeId: true },
    });
    for (const pc of allProcedureCodes) {
        cache.procedureCodes.set(procedureCodeHash(pc.typeId, pc.code), pc.id);
    }

    // Bulk-load provider groups for this carrier
    const carrierGroups = await prisma.provider_group.findMany({
        where: { insuranceCarrierId: context.insuranceCarrierId },
        select: { id: true, tinValue: true },
    });
    for (const pg of carrierGroups) {
        cache.providerGroups.set(
            providerGroupHash(context.insuranceCarrierId, pg.tinValue),
            pg.id,
        );
    }

    // Bulk-load providers linked to this carrier's groups
    const groupIds = carrierGroups.map((g) => g.id);
    if (groupIds.length > 0) {
        const junctions = await prisma.provider_group_provider.findMany({
            where: { providerGroupId: { in: groupIds } },
            select: {
                id: true,
                providerGroupId: true,
                providerId: true,
                provider: { select: { id: true, providerNPI: true } },
            },
        });

        for (const j of junctions) {
            cache.providers.set(providerHash(j.provider.providerNPI), j.provider.id);
            cache.providerGroupProviders.set(
                providerGroupProviderHash(j.providerGroupId, j.providerId),
                j.id,
            );
        }
    }

    jobCaches.set(insuranceScanJobId, cache);
    console.log(
        `Initialized cache for job ${insuranceScanJobId}: ` +
        `${cache.procedureCodes.size} procedure codes, ` +
        `${cache.providerGroups.size} provider groups, ` +
        `${cache.providers.size} providers, ` +
        `${cache.providerGroupProviders.size} junctions`,
    );

    return cache;
}

export function getJobCacheSync(insuranceScanJobId: string): JobCache | undefined {
    return jobCaches.get(insuranceScanJobId);
}

export function updateCacheProcedureCode(jobId: string, hash: string, id: number) {
    const cache = jobCaches.get(jobId);
    if (cache) cache.procedureCodes.set(hash, id);
}

export function updateCacheProviderGroup(jobId: string, hash: string, id: string) {
    const cache = jobCaches.get(jobId);
    if (cache) cache.providerGroups.set(hash, id);
}

export function updateCacheProvider(jobId: string, hash: string, id: string) {
    const cache = jobCaches.get(jobId);
    if (cache) cache.providers.set(hash, id);
}

export function updateCacheProviderGroupProvider(jobId: string, hash: string, id: string) {
    const cache = jobCaches.get(jobId);
    if (cache) cache.providerGroupProviders.set(hash, id);
}
