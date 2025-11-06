import { importCignaData } from "./ImportCigna";

export async function taskRoot(topic: String, taskPayload: TaskPayload, heartbeat?: () => Promise<void>) {
    if (topic === 'in-network-file') {
        // Call the in-network task handler
    } else if (topic === 'allowed-amount') {
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