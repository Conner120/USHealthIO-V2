import { type EachMessagePayload, Kafka } from 'kafkajs';
import { type TaskPayload, taskRoot } from "./tasks/taskRoot.ts";
import { redis } from "bun";
import { createId } from "@paralleldrive/cuid2";
import { prisma } from '@repo/database';

export const kafka = new Kafka({
    clientId: 'health-data-acquisition-system',
    brokers: [process.env.KAFKA_BROKER as string], // Replace it with your Kafka broker addresses
});
const kafkaProducer = new Kafka({
    clientId: 'health-data-acquisition-system',
    brokers: [process.env.KAFKA_BROKER as string], // Replace it with your Kafka broker addresses
});


// generate random node id
export const processId = createId();
await redis.hset('NODES', processId, "IDLE");
// Handle a graceful shutdown
const shutdown = async () => {
    try {
        await redis.hdel('NODES', processId);
        await consumer.disconnect();
        await producer.disconnect();
        console.log('Consumer disconnected');
        process.exit(0);
    } catch (error) {
        console.error('Error during consumer shutdown:', error);
        process.exit(1);
    }
};

process.on('SIGTERM', shutdown);
// handle nodemon restarts
process.on('SIGUSR2', shutdown);
process.on('SIGINT', shutdown);

export const producer = kafkaProducer.producer();
await producer.connect();
while (true) {
    const consumer = kafka.consumer({ groupId: `${process.env.KAFKA_PREFIX}hdas-parser` });
    const runConsumer = async () => {
        await consumer.connect();
        console.log('Consumer connected');
        await consumer.subscribe({ topics: ['insurance-source-scan-jobs', 'in-network-file', 'allowed-amount'].map(topic => `${process.env.KAFKA_PREFIX}${topic}`), fromBeginning: true }); // Subscribe to 'in_network', start from the beginning
        await consumer.run({
            eachMessage: async ({ topic, partition, message, heartbeat }: EachMessagePayload) => {
                try {

                    setInterval(heartbeat, 10000); // Send heartbeat every 10 seconds
                    let d = Date.now();
                    let job = message.value ? JSON.parse(message.value.toString()) as TaskPayload : null;
                    await prisma.insuranceScanJob.update({
                        where: {
                            id: job?.id
                        },
                        data: {
                            status: 'PENDING',
                            statusTime: new Date(),
                            startedAt: new Date(),
                        }
                    });
                    if (!job) {
                        console.error('Invalid message format:', message);
                        return;
                    }
                    console.log('Received message:', job);
                    await redis.hset('NODES', processId, job.id);
                    await taskRoot(topic, message.value ? JSON.parse(message.value.toString()) : {}, heartbeat);
                    await prisma.insuranceScanJob.update({
                        where: {
                            id: job.id
                        },
                        data: {
                            status: 'COMPLETED',
                            statusTime: new Date(),
                            completedAt: new Date(),
                        }
                    });
                    await redis.hset('NODES', processId, "IDLE");
                    console.log(`Processed message in ${Date.now() - d}ms`);
                } catch (error) {
                    console.error('Error processing message:', error);
                }
            },
        })
        console.log('Consumer started listening for messages');
    };
    runConsumer().catch(async (error) => {
        console.error('Error in consumer:', error);
        try {
            await consumer.disconnect();
        } catch (e) {
            console.error('Failed to disconnect consumer after error:', e);
        }
    });
    console.log("Consumer crashed, restarting in 5 seconds...");
    await new Promise(res => setTimeout(res, 5000));
}