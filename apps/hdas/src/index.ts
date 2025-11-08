import { type EachMessagePayload, Kafka } from 'kafkajs';
import { type TaskPayload, taskRoot } from "./tasks/taskRoot.ts";
import { redis } from "bun";
import { createId } from "@paralleldrive/cuid2";

export const kafka = new Kafka({
    clientId: 'health-data-acquisition-system',
    brokers: [process.env.KAFKA_BROKER as string], // Replace it with your Kafka broker addresses
});
const kafkaProducer = new Kafka({
    clientId: 'health-data-acquisition-system',
    brokers: [process.env.KAFKA_BROKER as string], // Replace it with your Kafka broker addresses
});

const consumer = kafka.consumer({ groupId: 'hdas-parser' });
export const producer = kafkaProducer.producer();
await producer.connect();
const runConsumer = async () => {
    await consumer.connect();
    console.log('Consumer connected');
    await consumer.subscribe({ topics: ['insurance-source-scan-jobs', 'in-network-file'], fromBeginning: true }); // Subscribe to 'in_network', start from the beginning
    await consumer.run({
        eachMessage: async ({ topic, partition, message, heartbeat }: EachMessagePayload) => {
            try {
                setInterval(heartbeat, 10000); // Send heartbeat every 10 seconds
                let d = Date.now();
                console.log(topic, partition)
                let job = message.value ? JSON.parse(message.value.toString()) as TaskPayload : null;
                if (!job) {
                    console.error('Invalid message format:', message);
                    return;
                }
                console.log('Received message:', job);
                await redis.hset('NODES', processId, job.id);
                await taskRoot(topic, message.value ? JSON.parse(message.value.toString()) : {}, heartbeat);
                await redis.hset('NODES', processId, "IDLE");
                console.log(`Processed message in ${Date.now() - d}ms`);
            } catch (error) {
                console.error('Error processing message:', error);
            }
        },
    });
    console.log('Consumer started listening for messages');
};
// generate random node id
export const processId = createId();
await redis.hset('NODES', processId, "IDLE");
runConsumer().catch(console.error);

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
