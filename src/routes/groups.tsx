import { createFileRoute } from "@tanstack/react-router";
export const Route = createFileRoute("/groups")({
  component: () => (
    <section className="mx-auto max-w-xl rounded-3xl border border-border bg-card p-6">
      <h1 className="font-display text-3xl font-bold">Your groups</h1>
      <p className="mt-4 text-muted-foreground">
        Your account is ready. Create or join a private group to start sharing expenses.
      </p>
    </section>
  ),
});
