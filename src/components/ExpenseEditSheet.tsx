import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
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
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { updateExpense } from "@/lib/api";
import { CATEGORIES, CATEGORY_EMOJI } from "@/lib/format";
import { useRefreshAll } from "@/lib/queries";
import type { Category, Expense, Member } from "@/lib/types";

export function ExpenseEditSheet({
  expense,
  members,
  onClose,
}: {
  expense: Expense | null;
  members: Member[];
  onClose: () => void;
}) {
  const [e, setE] = useState<Expense | null>(expense);
  const [saving, setSaving] = useState(false);
  const refresh = useRefreshAll();
  useEffect(() => setE(expense), [expense]);

  const reshare = (cur: Expense, amount: number, ids: string[]): Expense => ({
    ...cur,
    amount,
    shares: splitEqually(amount, ids, cur.payerId).map((s) => ({
      memberId: s.key,
      amount: s.amount,
    })),
  });

  async function save() {
    if (!e) return;
    if (!e.shares.length) {
      toast.error("Pick at least one person to split with");
      return;
    }
    setSaving(true);
    try {
      await updateExpense(e.id, e);
      await refresh();
      toast.success("Expense updated");
      onClose();
    } catch (err) {
      toast.error("Couldn't update", {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open={!!expense} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        side="bottom"
        className="mx-auto max-h-[90vh] max-w-xl overflow-y-auto rounded-t-3xl"
      >
        <SheetHeader>
          <SheetTitle>Edit expense</SheetTitle>
        </SheetHeader>
        {e && (
          <div className="space-y-3 px-4 pb-6">
            <Input
              value={e.description}
              onChange={(ev) => setE({ ...e, description: ev.target.value })}
              className="h-12 rounded-xl"
              aria-label="Description"
            />
            <div className="grid grid-cols-2 gap-3">
              <Select value={e.payerId} onValueChange={(v) => setE({ ...e, payerId: v })}>
                <SelectTrigger aria-label="Paid by" className="h-12 rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {members.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      Paid by {m.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                type="number"
                value={e.amount}
                onChange={(ev) =>
                  setE(
                    reshare(
                      e,
                      Number(ev.target.value) || 0,
                      e.shares.map((s) => s.memberId),
                    ),
                  )
                }
                className="h-12 rounded-xl"
                aria-label="Amount"
              />
              <Select
                value={e.category}
                onValueChange={(v) => setE({ ...e, category: v as Category })}
              >
                <SelectTrigger aria-label="Category" className="h-12 rounded-xl capitalize">
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
              <Input
                type="date"
                aria-label="Date"
                value={e.date}
                onChange={(ev) => setE({ ...e, date: ev.target.value })}
                className="h-12 rounded-xl"
              />
            </div>
            <SplitChips
              items={members.map((m) => ({
                key: m.id,
                label: m.name,
                selected: e.shares.some((s) => s.memberId === m.id),
                share: e.shares.find((s) => s.memberId === m.id)?.amount,
              }))}
              onToggle={(id) => {
                const ids = e.shares.map((s) => s.memberId);
                setE(
                  reshare(
                    e,
                    e.amount,
                    ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id],
                  ),
                );
              }}
            />
            {e.rawText && (
              <p className="rounded-xl bg-muted p-3 text-xs italic text-muted-foreground">
                "{e.rawText}"
              </p>
            )}
            <Button className="h-14 w-full rounded-2xl text-base" onClick={save} disabled={saving}>
              {saving && <Loader2 className="h-5 w-5 animate-spin" />} Save changes
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
