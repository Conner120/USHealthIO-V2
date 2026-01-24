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
        stream: `in_network_rates-${process.env.SHARD_ID || 0}`,
        offset: Offset.first(),
    }
    let count = 0
    let start = Date.now()
    const consumer = await client.declareConsumer(consumerOptions, async (message: Message) => {
        count++;
        let data = ProtoProviderNegotiationKafkaMessage.decode(message.content);
        if (count % 1000 === 0) {
            let duration = (Date.now() - start) / 1000;
            console.log(`Processed ${count} messages in ${duration} seconds (${(count / duration).toFixed(2)} msg/sec)`);
        }
    })
}

async function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

main();