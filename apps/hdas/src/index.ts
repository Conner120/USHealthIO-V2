import {type EachMessagePayload, Kafka} from 'kafkajs';
import {type TaskPayload, taskRoot} from "./tasks/taskRoot.ts";
import {redis} from "bun";
import {createId} from "@paralleldrive/cuid2";

export const kafka = new Kafka({
    clientId: 'health-data-acquisition-system',
    brokers: [process.env.KAFKA_BROKER as string], // Replace it with your Kafka broker addresses
});


const consumer = kafka.consumer({groupId: 'hdas-parser'});
const runConsumer = async () => {
    await consumer.connect();
    console.log('Consumer connected');
    await consumer.subscribe({topic: 'insurance-source-scan-jobs', fromBeginning: true}); // Subscribe to 'in_network', start from the beginning
    await consumer.run({
        eachMessage: async ({topic, partition, message}: EachMessagePayload) => {
            console.log(topic, partition)
            let job = message.value ? JSON.parse(message.value.toString()) as TaskPayload : null;
            if (!job) {
                console.error('Invalid message format:', message);
                return;
            }
            console.log('Received message:', job);
            await redis.hset('NODES', processId, job.id);
            await taskRoot(topic, message.value ? JSON.parse(message.value.toString()) : {});
            await redis.hset('NODES', processId, "IDLE");
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
        console.log('Consumer disconnected');
        process.exit(0);
    } catch (error) {
        console.error('Error during consumer shutdown:', error);
        process.exit(1);
    }
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
