import { fetchQueueStatus } from "@/lib/queue";
import { QueueDashboard } from "./_components/queueDashboard";

export const dynamic = "force-dynamic";

export default async function QueuesPage() {
  const initial = await fetchQueueStatus();
  return (
    <main className="flex-1">
      <div className="space-y-6 px-4 py-6">
        <div>
          <h2 className="text-2xl font-bold">Job Queues</h2>
          <p className="text-muted-foreground">Live view of Redis queues, in-flight work and nodes</p>
        </div>
        <QueueDashboard initial={initial} />
      </div>
    </main>
  );
}
