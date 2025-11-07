import axios from "axios";
import { $ } from "bun";
import { importCignaData } from "./ImportCigna";
let t = BigInt(0);
export async function taskRoot(topic: String, taskPayload: TaskPayload, heartbeat?: () => Promise<void>) {
    if (topic === 'in-network-file') {
        console.log("Processing in-network file with payload:", taskPayload);
        let data = await $`curl -O ${taskPayload.payload.url} -o /tmp/${taskPayload.id}`;
        // get size of downloaded file
        let size = (await $`du -sb /tmp/${taskPayload.id}`).stdout.toString().split("\t")[0];
        if (!size) {
            throw new Error("Failed to get size of downloaded in-network file");
        }
        console.log("Fetched in-network file data:", size, "bytes");
        t += BigInt(size);
        console.log("Total in-network data processed so far (bytes):", t.toString());
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