"use server"
import { Kafka } from "kafkajs";
import { Prisma, prisma } from "@repo/database";
import { generateId, IDTYPE } from "@repo/id-gen";
import { withAuth } from "@workos-inc/authkit-nextjs";

const kafka = new Kafka({
    clientId: 'health-admin',
    brokers: [process.env.KAFKA_BROKER as string], // Replace it with your Kafka broker addresses
});

export async function SendTICJobTrigger(id: string, jobId: string) {
    const { user } = await withAuth({ ensureSignedIn: true });
    const producer = kafka.producer()
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
            statusTime: new Date(),
            createdBy: user?.id as string,
            updatedBy: user?.id as string,
        }
    })
    await producer.connect()
    await producer.send({
        topic: `${process.env.KAFKA_PREFIX}insurance-source-scan-jobs`,
        messages: [
            {
                value: JSON.stringify({
                    id: scanJob.id,
                    type: 'insurance-source-scan-jobs',
                    payload: importSource
                })
            },
        ],
    })
    // sleep for 200ms
    await new Promise(resolve => setTimeout(resolve, 200))

    await producer.disconnect()
}