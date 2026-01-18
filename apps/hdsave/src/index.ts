import { connect, Offset } from "rabbitmq-stream-js-client"
import type { Message } from "rabbitmq-stream-js-client/dist/publisher"
import { provider } from "./bundle";
import * as console from "node:console";
import * as process from "node:process";
import ProtoProviderNegotiationKafkaMessage = provider.ProtoProviderNegotiationKafkaMessage;

async function main() {
    const client = await connect({
        hostname: process.env.RABBITMQ_HOST || "localhost",
        port: 5552,
        username: process.env.RABBITMQ_USER || "guest",
        password: process.env.RABBITMQ_PASSWORD || "guest",
        vhost: "/",
    })

    const consumerOptions = {
        stream: `in_network_rates-${process.env.ID}`,
        offset: Offset.first(),
    }
    let count = 0
    let start = Date.now()
    const consumer = await client.declareConsumer(consumerOptions, async (message: Message) => {
        count++;
        let data = ProtoProviderNegotiationKafkaMessage.decode(message.content);
        // await sleep(100);
        // print every 1000 messages and the rate
        if (count % 2000 === 0) {
            const now = Date.now();
            const rate = count / ((now - start) / 1000);
            console.log(`Received ${count} messages. Rate: ${rate.toFixed(2)} messages/second. at: ${message.offset}`);
            start = now;
            count = 0;
            // ack the message
        }
    })
}

async function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

main();