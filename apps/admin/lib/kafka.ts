"use server"
import { prisma } from "@repo/database";
import { generateId, IDTYPE } from "@repo/id-gen";
import { withAuth } from "@workos-inc/authkit-nextjs";
import { Connection } from 'rabbitmq-client'

// Initialize:
const rabbit = new Connection(`amqp://${process.env.RABBITMQ_USER || "guest"}:${process.env.RABBITMQ_PASSWORD || "guest"}@${process.env.RABBITMQ_HOST || "localhost"}:5672`)
rabbit.on('error', (err) => {
    console.log('RabbitMQ connection error', err)
})
rabbit.on('connection', () => {
    console.log('Connection successfully (re)established')
})
const pub = rabbit.createPublisher({
    // Enable publish confirmations, similar to consumer acknowledgements
    confirm: true,
    // Enable retries
    maxAttempts: 2,
    // Optionally ensure the existence of an exchange before we use it
    exchanges: [{ exchange: 'jobs', type: 'direct' }],
})
export async function SendTICJobTrigger(id: string, jobId: string) {
    const { user } = await withAuth({ ensureSignedIn: true });
    const importSource = await prisma.insuranceScanSource.findFirst(
        {
            where: {
                id
            }
        }
    );
    if (!importSource) {
        return Error("Import source not found")
    }
    const scanJob = await prisma.insuranceScanJob.create({
        data: {
            id: generateId(IDTYPE.INSURANCE_SCAN_JOB),
            insuranceScanSourceId: importSource.id,
            status: 'PENDING',
            fileType: 'TABLE_OF_CONTENTS',
            statusTime: new Date(),
            createdBy: user?.id as string,
            updatedBy: user?.id as string,
        }
    })
    console.log('Publishing TIC Job Trigger for scan job', scanJob.id);
    await pub.send({
        exchange: 'jobs',
    }, {
        id: scanJob.id,
        type: 'insurance-source-scan-jobs',
        payload: importSource
    });
}