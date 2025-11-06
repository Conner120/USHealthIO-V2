export async function taskRoot(topic: String, taskPayload: TaskPayload) {
    if (topic === 'in-network-file') {
        // Call the in-network task handler
    } else if (topic === 'allowed-amount') {
        // Call the allowed-amount task handler
    } else if (topic === 'insurance-source-scan-jobs') {
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