import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { HelpCircle, Loader2, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { EmptyState, ListSkeleton, PageTitle } from "@/components/States";
import { SplitChips, splitEqually } from "@/components/SplitChips";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { saveExpenses } from "@/lib/api";
import { setDraft, useDraft } from "@/lib/draft";
import { CATEGORIES, CATEGORY_EMOJI } from "@/lib/format";
import { useGroup, useRefreshAll } from "@/lib/queries";
import type { Member, ParsedExpense } from "@/lib/types";
import { activeMembers } from "@/lib/active-members";

export const Route = createFileRoute("/review")({
  head: () => ({
    meta: [
      { title: "Review expenses — Hostel Khata" },
      {
        name: "description",
        content: "Check the parsed expenses and who shares each one before saving.",
      },
      { property: "og:title", content: "Review expenses — Hostel Khata" },
      {
        property: "og:description",
        content: "Check the parsed expenses and who shares each one before saving.",
      },
    ],
  }),
  component: ReviewPage,
});

function ReviewPage() {
  const draft = useDraft();
  const { data: group, isLoading } = useGroup();
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();
  const refresh = useRefreshAll();

  const update = (i: number, next: ParsedExpense) =>
    setDraft(draft.map((d, j) => (j === i ? next : d)));

  if (!draft.length)
    return (
      <EmptyState
        emoji="📝"
        title="Nothing to review"
        body="Parse some text on the Add tab first."
        action={
          <Button asChild>
            <Link to="/">Go to Add</Link>
          </Button>
        }
      />
    );

  async function onSave() {
    setSaving(true);
    try {
      const saved = await saveExpenses(draft);
      setDraft([]);
      await refresh();
      toast.success(`${saved.length} expense${saved.length > 1 ? "s" : ""} saved`);
      navigate({ to: "/balances" });
    } catch (e) {
      toast.error("Couldn't save", { description: e instanceof Error ? e.message : undefined });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <PageTitle
        title="Review"
        subtitle={`${draft.length} expense${draft.length > 1 ? "s" : ""} found — edit if needed`}
      />
      {isLoading || !group ? (
        <ListSkeleton rows={2} h="h-64" />
      ) : (
        draft.map((p, i) => (
          <ParsedCard
            key={i}
            value={p}
            members={activeMembers(group.members)}
            onChange={(n) => update(i, n)}
            onRemove={() => setDraft(draft.filter((_, j) => j !== i))}
          />
        ))
      )}
      <div className="sticky bottom-20 flex gap-3 rounded-3xl bg-background/90 py-2 backdrop-blur">
        <Button
          variant="outline"
          className="h-14 flex-1 rounded-2xl"
          onClick={() => {
            setDraft([]);
            navigate({ to: "/" });
          }}
        >
          Discard
        </Button>
        <Button
          className="h-14 flex-[2] rounded-2xl text-base font-semibold"
          onClick={onSave}
          disabled={saving || !group || draft.some((p) => p.needsClarification)}
        >
          {saving && <Loader2 className="h-5 w-5 animate-spin" />} Save all
        </Button>
      </div>
    </div>
  );
}

function ParsedCard({
  value: p,
  members,
  onChange,
  onRemove,
}: {
  value: ParsedExpense;
  members: Member[];
  onChange: (p: ParsedExpense) => void;
  onRemove: () => void;
}) {
  const withShares = (amount: number, participants: string[]): ParsedExpense => ({
    ...p,
    amount,
    participants,
    splitType: "equal",
    shares: splitEqually(amount, participants, p.payer).map((s) => ({
      member: s.key,
      amount: s.amount,
    })),
  });
  const toggle = (name: string) => {
    const next = p.participants.includes(name)
      ? p.participants.filter((n) => n !== name)
      : [...p.participants, name];
    onChange(withShares(p.amount, next));
  };

  return (
    <div
      className={`receipt-card space-y-3 rounded-3xl border-2 bg-card p-5 shadow-sm ${
        p.needsClarification ? "border-warning" : "border-border"
      }`}
    >
      {p.needsClarification && p.question && (
        <div className="flex items-start gap-2 rounded-2xl bg-warning-soft p-3 text-sm text-warning-foreground">
          <HelpCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{p.question}</span>
        </div>
      )}
      <div className="flex items-center gap-2">
        <span className="text-2xl">{CATEGORY_EMOJI[p.category] ?? "📦"}</span>
        <Input
          value={p.description}
          onChange={(e) => onChange({ ...p, description: e.target.value })}
          className="h-11 flex-1 rounded-xl font-semibold"
          aria-label="Description"
        />
        <Button
          variant="ghost"
          size="icon"
          className="h-11 w-11"
          onClick={onRemove}
          aria-label="Remove"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <label className="text-xs text-muted-foreground">
          Paid by
          <Select
            value={p.payer}
            onValueChange={(v) =>
              onChange({
                ...p,
                payer: v,
                shares:
                  p.splitType === "equal"
                    ? splitEqually(p.amount, p.participants, v).map((s) => ({
                        member: s.key,
                        amount: s.amount,
                      }))
                    : p.shares,
              })
            }
          >
            <SelectTrigger aria-label="Paid by" className="mt-1 h-11 rounded-xl text-foreground">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {members.map((m) => (
                <SelectItem key={m.id} value={m.name}>
                  {m.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
        <label className="text-xs text-muted-foreground">
          Amount (₹)
          <Input
            type="number"
            inputMode="decimal"
            value={p.amount}
            onChange={(e) => onChange(withShares(Number(e.target.value) || 0, p.participants))}
            className="mt-1 h-11 rounded-xl text-foreground"
          />
        </label>
        <label className="text-xs text-muted-foreground">
          Category
          <Select value={p.category} onValueChange={(v) => onChange({ ...p, category: v })}>
            <SelectTrigger
              aria-label="Category"
              className="mt-1 h-11 rounded-xl capitalize text-foreground"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CATEGORIES.map((c) => (
                <SelectItem key={c} value={c} className="capitalize">
                  {CATEGORY_EMOJI[c]} {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
        <label className="text-xs text-muted-foreground">
          Date
          <Input
            type="date"
            value={p.date}
            onChange={(e) => onChange({ ...p, date: e.target.value })}
            className="mt-1 h-11 rounded-xl text-foreground"
          />
        </label>
      </div>
      <div>
        <p className="mb-2 text-xs text-muted-foreground">Split between (tap to toggle)</p>
        <SplitChips
          items={members.map((m) => ({
            key: m.name,
            label: m.name,
            selected: p.participants.includes(m.name),
            share: p.shares.find((s) => s.member === m.name)?.amount,
          }))}
          onToggle={toggle}
        />
        {p.participants
          .filter((name) => !members.some((m) => m.name === name))
          .map((name) => (
            <Button
              key={name}
              variant="outline"
              className="mt-2 min-h-11"
              onClick={() => toggle(name)}
            >
              Remove unknown participant: {name}
            </Button>
          ))}
        {p.needsClarification && p.splitType !== "equal" && (
          <Button
            variant="outline"
            className="mt-2 min-h-11"
            onClick={() => onChange(withShares(p.amount, p.participants))}
          >
            Use an equal split instead
          </Button>
        )}
      </div>
      {p.needsClarification && (
        <Button
          variant="outline"
          className="min-h-11 w-full rounded-xl"
          onClick={() => {
            const known = p.participants.filter((name) => members.some((m) => m.name === name));
            const valid =
              p.amount > 0 &&
              members.some((m) => m.name === p.payer) &&
              known.length === p.participants.length &&
              known.length > 0 &&
              (p.splitType === "equal" ||
                Math.round(p.shares.reduce((sum, s) => sum + s.amount, 0) * 100) ===
                  Math.round(p.amount * 100));
            if (!valid) {
              toast.error(
                "Choose a payer, a positive amount and all participants. Toggle participants to use an equal split if needed.",
              );
              return;
            }
            onChange({ ...p, needsClarification: false, question: null });
          }}
        >
          Confirm payer, amount and split
        </Button>
      )}
    </div>
  );
}
