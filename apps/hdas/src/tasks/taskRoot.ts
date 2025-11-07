import axios from "axios";
import { $, redis } from "bun";
import { importCignaData } from "./ImportCigna";
let t = BigInt(0);
export async function taskRoot(topic: String, taskPayload: TaskPayload, heartbeat?: () => Promise<void>) {
    if (topic === 'in-network-file') {
        console.log("Processing in-network file with payload:", taskPayload);
        let data = await fetch(taskPayload.payload.url);
        if (data.status !== 200) {
            throw new Error(`Failed to fetch in-network file, status code: ${data.status}`);
        }
        let size = (await data.body?.bytes())?.length?.toString();
        if (!size) {
            throw new Error("Failed to get size of downloaded in-network file");
        }
        let sizeNum = parseInt(size);
        console.log("Fetched in-network file data:", size, "bytes");
        t += BigInt(size);
        console.log("Total in-network data processed so far (bytes):", t.toString());
        redis.incrby(`${taskPayload.payload.jobId}:TOTAL_BYTES_PROCESSED`, sizeNum);
        redis.incrby(`${taskPayload.payload.jobId}:TOTAL_FILES_PROCESSED`, 1);
        redis.incrby(`${taskPayload.payload.jobId}:IN_NETWORK_TOTAL_BYTES_PROCESSED`, sizeNum);
        redis.incrby(`${taskPayload.payload.jobId}:IN_NETWORK_TOTAL_FILES_PROCESSED`, 1);
        // Call the in-network task handler
    } else if (topic === 'allowed-amount') {
        console.log("Processing allowed-amount file with payload:", taskPayload);
        let data = await fetch(taskPayload.payload.url);
        if (data.status !== 200) {
            throw new Error(`Failed to fetch allowed-amount file, status code: ${data.status}`);
        }
        let size = (await data.body?.bytes())?.length || 0;
        console.log("Fetched allowed-amount file data:", size, "bytes");
        t += BigInt(size);
        console.log("Total allowed-amount data processed so far (bytes):", t.toString());
        redis.incrby(`${taskPayload.payload.jobId}:TOTAL_BYTES_PROCESSED`, size);
        redis.incrby(`${taskPayload.payload.jobId}:TOTAL_FILES_PROCESSED`, 1);
        redis.incrby(`${taskPayload.payload.jobId}:ALLOWED_AMOUNT_TOTAL_BYTES_PROCESSED`, size);
        redis.incrby(`${taskPayload.payload.jobId}:ALLOWED_AMOUNT_TOTAL_FILES_PROCESSED`, 1);
        // Call the allowed-amount task handler
    } else if (topic === 'insurance-source-scan-jobs') {
        if (taskPayload.payload.sourceType === 'CIGNA_INDEX_API') {
            await importCignaData(taskPayload.payload);
        }
        // Call the insurance source scan job handler
    } else {
        console.error(`Unknown topic: ${topic}`);
    }
}

export interface TaskPayload {
    id: string,
    jobType: 'in-network-file' | 'allowed-amount' | 'insurance-source-scan-jobs',
    payload: any,
}