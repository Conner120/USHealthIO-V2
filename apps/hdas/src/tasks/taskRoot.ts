export async function taskRoot(taskPayload: TaskPayload) {
    console.log('Task root started');
}

export  interface TaskPayload {
    id: string,
    jobType: 'in-network' | 'allowed-amount'
}