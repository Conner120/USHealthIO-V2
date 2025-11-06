"use server"
import {Kafka} from "kafkajs";
import {prisma} from "@repo/database";

const kafka = new Kafka({
    clientId: 'health-admin',
    brokers: [process.env.KAFKA_BROKER as string], // Replace it with your Kafka broker addresses
});

export async function SendTICJobTrigger(id: string, jobId: string) {
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
    await producer.connect()
    await producer.send({
        topic: 'insurance-source-scan-jobs',
        messages: [
            {
                value: JSON.stringify({
                    jobId: jobId,
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