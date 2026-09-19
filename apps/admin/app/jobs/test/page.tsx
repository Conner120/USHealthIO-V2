import { TestJobsForm } from "./_components/testJobsForm";

export default function TestJobsPage() {
  return (
    <main className="flex-1">
      <div className="space-y-6 px-4 py-6">
        <div>
          <h2 className="text-2xl font-bold">Test Jobs</h2>
          <p className="text-muted-foreground">Send hardcoded jobs to the Redis queues. UnitedHealthcare only for now.</p>
        </div>
        <TestJobsForm />
      </div>
    </main>
  );
}
