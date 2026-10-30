import { createFileRoute, Link } from "@tanstack/react-router";
import { Copy } from "lucide-react";
import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
} from "recharts";
import { toast } from "sonner";
import { EmptyState, ErrorState, ListSkeleton, PageTitle } from "@/components/States";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CATEGORY_COLOR, CATEGORY_EMOJI, inr, memberName } from "@/lib/format";
import { useGroup, useReport } from "@/lib/queries";
import { Money } from "@/components/Money";

export const Route = createFileRoute("/report")({
  head: () => ({
    meta: [
      { title: "Monthly report — Hostel Khata" },
      {
        name: "description",
        content: "Monthly spend by category and per person, with a WhatsApp-ready summary.",
      },
      { property: "og:title", content: "Monthly report — Hostel Khata" },
      {
        property: "og:description",
        content: "Monthly spend by category and per person, with a WhatsApp-ready summary.",
      },
    ],
  }),
  component: ReportPage,
});

function lastMonths(n: number) {
  const out: { value: string; label: string }[] = [];
  const d = new Date();
  d.setDate(1);
  for (let i = 0; i < n; i++) {
    out.push({
      value: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      label: d.toLocaleDateString("en-IN", { month: "long", year: "numeric" }),
    });
    d.setMonth(d.getMonth() - 1);
  }
  return out;
}

function ReportPage() {
  const months = useMemo(() => lastMonths(6), []);
  const [month, setMonth] = useState(months[0]!.value);
  const { data: group } = useGroup();
  const q = useReport(month);

  const cats = Object.entries(q.data?.byCategory ?? {}).map(([name, value]) => ({ name, value }));
  const people = (q.data?.byMember ?? []).map((b) => ({
    name: memberName(group?.members, b.memberId),
    Paid: b.paid,
    Share: b.owed,
  }));

  return (
    <div className="space-y-4">
      <PageTitle title="Report" />
      <Link to="/wrapped" className="block rounded-3xl border border-primary/30 bg-primary/10 p-5">
        <span className="font-display text-xl font-bold text-primary">
          ✨ Your Hostel Wrapped is here
        </span>
        <span className="mt-1 block text-sm text-muted-foreground">
          Your gang's month, in stories and legendary awards →
        </span>
      </Link>
      <Select value={month} onValueChange={setMonth}>
        <SelectTrigger aria-label="Report month" className="h-12 rounded-xl">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {months.map((m) => (
            <SelectItem key={m.value} value={m.value}>
              {m.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {q.isLoading ? (
        <ListSkeleton rows={3} h="h-48" />
      ) : q.isError ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : !q.data?.total ? (
        <EmptyState
          emoji="📊"
          title="No spending this month"
          body="Pick another month or add expenses."
        />
      ) : (
        <>
          <div className="rounded-3xl bg-primary p-5 text-primary-foreground shadow-sm">
            <p className="text-sm opacity-80">Total spent</p>
            <p className="font-display text-4xl font-bold md:text-6xl">
              <Money amount={q.data.total} />
            </p>
          </div>

          <div className="rounded-3xl border border-border bg-card p-4 shadow-sm">
            <h2 className="mb-2 font-semibold">By category</h2>
            <div className="h-56">
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    isAnimationActive={false}
                    data={cats}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={2}
                  >
                    {cats.map((c) => (
                      <Cell key={c.name} fill={CATEGORY_COLOR[c.name]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => inr(v)} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <ul className="grid grid-cols-2 gap-2 text-sm">
              {cats
                .sort((a, b) => b.value - a.value)
                .map((c) => (
                  <li key={c.name} className="flex items-center gap-2 capitalize">
                    <span
                      className="h-3 w-3 rounded-full"
                      style={{ background: CATEGORY_COLOR[c.name] }}
                    />
                    {CATEGORY_EMOJI[c.name]} {c.name}
                    <span className="ml-auto font-semibold">{inr(c.value)}</span>
                  </li>
                ))}
            </ul>
          </div>

          <div className="rounded-3xl border border-border bg-card p-4 shadow-sm">
            <h2 className="mb-2 font-semibold">Paid vs share</h2>
            <div className="h-64">
              <ResponsiveContainer>
                <BarChart data={people}>
                  <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={12} />
                  <YAxis tickLine={false} axisLine={false} fontSize={11} width={40} />
                  <Tooltip formatter={(v: number) => inr(v)} />
                  <Legend />
                  <Bar
                    isAnimationActive={false}
                    dataKey="Paid"
                    fill="var(--chart-1)"
                    radius={[6, 6, 0, 0]}
                  />
                  <Bar
                    isAnimationActive={false}
                    dataKey="Share"
                    fill="var(--chart-3)"
                    radius={[6, 6, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <Button
            className="h-14 w-full rounded-2xl text-base"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(q.data!.summaryText);
                toast.success("Summary copied — paste it in WhatsApp");
              } catch {
                toast.error("Couldn't copy. Check clipboard permission and try again.");
              }
            }}
          >
            <Copy className="h-5 w-5" /> Copy summary for WhatsApp
          </Button>
        </>
      )}
    </div>
  );
}
