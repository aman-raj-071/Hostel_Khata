import { useNavigate } from "@tanstack/react-router";
import { useExpenses, useGroup } from "@/lib/queries";
import { RECURRING, recurringPreview } from "@/lib/templates";
import { setDraft } from "@/lib/draft";
import { Button } from "@/components/ui/button";

export function RecurringTemplates() {
  const group = useGroup();
  const history = useExpenses({});
  const navigate = useNavigate();
  if (group.isPending || history.isPending)
    return <p className="text-sm text-muted-foreground">Loading repeat expenses…</p>;
  if (!group.data || history.isError)
    return (
      <p className="text-sm text-muted-foreground">
        Repeat expenses unavailable. You can still type a new expense.
      </p>
    );
  return (
    <section className="rounded-3xl border border-border bg-card p-4" aria-label="Repeat expenses">
      <p className="mb-3 text-sm text-muted-foreground">
        Repeat a bill · review today’s amount before saving
      </p>
      <div className="flex flex-wrap gap-2">
        {RECURRING.map((template, index) => (
          <Button
            key={template.name}
            variant="outline"
            onClick={() => {
              const date = new Intl.DateTimeFormat("en-CA", {
                timeZone: "Asia/Kolkata",
                year: "numeric",
                month: "2-digit",
                day: "2-digit",
              }).format(new Date());
              setDraft(
                [recurringPreview(index, history.data ?? [], group.data!, date)],
                "Recurring template: " + template.name,
              );
              void navigate({ to: "/review" });
            }}
          >
            Repeat {template.name}
          </Button>
        ))}
      </div>
    </section>
  );
}
