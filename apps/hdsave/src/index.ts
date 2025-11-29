import { type EachMessagePayload, Kafka } from 'kafkajs';
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
const consumer = kafka.consumer({ groupId: `${process.env.KAFKA_PREFIX}hdas-parser` });
await consumer.connect();
console.log('Consumer connected');
await consumer.subscribe({ topics: ['in-network-rates'].map(topic => `${process.env.KAFKA_PREFIX}${topic}`), fromBeginning: true }); // Subscribe to 'in_network', start from the beginning
await consumer.run({
    eachMessage: async ({ topic, partition, message, heartbeat }: EachMessagePayload) => {
        console.log(`Received message on topic ${topic}, partition ${partition}`);
    },
});