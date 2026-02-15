import { prisma } from "@repo/database";
import type { JobContext } from "./types.ts";

const jobContextCache = new Map<string, JobContext>();

export async function getJobContext(insuranceScanJobId: string): Promise<JobContext> {
    const cached = jobContextCache.get(insuranceScanJobId);
    if (cached) return cached;

    const job = await prisma.insuranceScanJob.findUniqueOrThrow({
        where: { id: insuranceScanJobId },
        select: {
            insurancePlanIds: true,
            insuranceScanSource: {
                select: { insuranceCompanyId: true },
            },
        },
    });

    const insuranceCarrierId = job.insuranceScanSource?.insuranceCompanyId;
    if (!insuranceCarrierId) {
        throw new Error(`Job ${insuranceScanJobId} has no associated insurance company`);
    }

    const context: JobContext = {
        insurancePlanIds: job.insurancePlanIds,
        insuranceCarrierId,
    };

    jobContextCache.set(insuranceScanJobId, context);
    return context;
}
