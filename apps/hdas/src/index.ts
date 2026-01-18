// import { type TaskPayload, taskRoot } from "./tasks/taskRoot.ts";
import { redis } from "bun";
import { createId } from "@paralleldrive/cuid2";
import { prisma } from '@repo/database';
import { Connection } from 'rabbitmq-client'
import { taskRoot } from "./tasks/taskRoot";


// Initialize:
const rabbit = new Connection(`amqp://${process.env.RABBITMQ_USER || "guest"}:${process.env.RABBITMQ_PASSWORD || "guest"}@${process.env.RABBITMQ_HOST || "localhost"}:5672`)
rabbit.on('error', (err) => {
    console.log('RabbitMQ connection error', err)
})
rabbit.on('connection', () => {
    console.log('Connection successfully (re)established')
})
export const pub = rabbit.createPublisher({
    // Enable publish confirmations, similar to consumer acknowledgements
    confirm: true,
    // Enable retries
    maxAttempts: 2,
    // Optionally ensure the existence of an exchange before we use it
    exchanges: [{ exchange: 'tic-data', type: 'topic' }],
})

// generate random node id
export const processId = createId();
await redis.hset('NODES', processId, "IDLE");


let sub = await rabbit.createConsumer({
    queue: 'hdas-jobs',
    queueOptions: { durable: true },
    qos: { prefetchCount: 1 },
}, async (msg) => {
    try {
        let d = Date.now();
        let job = msg.body;
        console.log(job);
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
            console.error('Invalid message format:', msg);
            return;
        }
        await redis.hset('NODES', processId, job.id);
        await taskRoot(job.type, job);
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
});
// Handle a graceful shutdown
const shutdown = async () => {
    try {
        sub.close();
        rabbit.close();
        console.log('Consumer and publisher shut down gracefully.');
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