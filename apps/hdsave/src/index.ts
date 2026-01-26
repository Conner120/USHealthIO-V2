import {connect, Offset} from "rabbitmq-stream-js-client"
import type {Message} from "rabbitmq-stream-js-client/dist/publisher"
import {provider} from "./bundle";
import * as process from "node:process";
import {redis} from "bun";
import ProtoProviderNegotiationKafkaMessage = provider.ProtoProviderNegotiationKafkaMessage;

const GB_BYTES = 1024 * 1024 * 1024;
const shardId = (process.env.HOSTNAME ?? "").split("-").pop() || process.env.SHARD_ID || 0

async function main() {
    const client = await connect({
        hostname: process.env.RABBITMQ_HOST || "localhost",
        port: 5552,
        username: process.env.RABBITMQ_USER || "guest",
        password: process.env.RABBITMQ_PASSWORD || "guest",
        vhost: "/",
    })
    client.createStream({
        stream: `in_network_rates-${shardId}`,
        arguments: {
            'max-length-bytes': GB_BYTES * 5
        }
    }).catch((err) => {
    });
    const startOffset = await redis.hget(`in_network_rates_${shardId}`, "offset");
    const consumerOptions = {
        stream: `in_network_rates-${shardId}`,
        offset: Offset.first()
    }
    if (startOffset) {
        consumerOptions.offset = Offset.offset(BigInt(startOffset));
        console.log(`Node: ${shardId} Resuming from offset ${startOffset}`);
    } else {
        console.log(`Node: ${shardId} Starting from beginning`);
    }
    let count = 0
    let start = Date.now()
    const consumer = await client.declareConsumer(consumerOptions, async (message: Message) => {
        count++;
        let data = ProtoProviderNegotiationKafkaMessage.decode(message.content);
        if (count % 1000 === 0) {
            let duration = (Date.now() - start) / 1000;
            console.log(`Node: ${shardId} Processed ${count} messages in ${duration} seconds (${(count / duration).toFixed(2)} msg/sec)`);
            if (message.offset)
                await redis.hset(`in_network_rates_${shardId}`, "offset", message.offset?.toString())
        }
    })
}

main();