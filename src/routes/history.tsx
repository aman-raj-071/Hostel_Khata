import { createFileRoute } from "@tanstack/react-router";
import { Search, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ExpenseEditSheet } from "@/components/ExpenseEditSheet";
import { Avatar, EmptyState, ErrorState, ListSkeleton, PageTitle } from "@/components/States";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { deleteExpense } from "@/lib/api";
import { CATEGORY_EMOJI, inr, memberName, prettyDate } from "@/lib/format";
import { useExpenses, useGroup, useRefreshAll } from "@/lib/queries";
import type { Expense } from "@/lib/types";

export const Route = createFileRoute("/history")({
  head: () => ({
    meta: [
      { title: "History — Hostel Khata" },
      { name: "description", content: "Search, filter, edit and delete past flat expenses." },
      { property: "og:title", content: "History — Hostel Khata" },
      {
        property: "og:description",
        content: "Search, filter, edit and delete past flat expenses.",
      },
    ],
  }),
  component: HistoryPage,
});

function HistoryPage() {
  const { data: group } = useGroup();
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [memberId, setMemberId] = useState("all");
  const [editing, setEditing] = useState<Expense | null>(null);
  const [deleting, setDeleting] = useState<Expense | null>(null);
  const refresh = useRefreshAll();

  useEffect(() => {
    const t = setTimeout(() => setQ(search), 250);
    return () => clearTimeout(t);
  }, [search]);

  const list = useExpenses({
    q: q || undefined,
    memberId: memberId === "all" ? undefined : memberId,
  });

  async function confirmDelete() {
    if (!deleting) return;
    try {
      await deleteExpense(deleting.id);
      await refresh();
      toast.success("Expense deleted");
    } catch (e) {
      toast.error("Couldn't delete", { description: e instanceof Error ? e.message : undefined });
    }
    setDeleting(null);
  }

  return (
    <div>
      <PageTitle title="History" />
      <div className="mb-4 flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
          <Input
            aria-label="Search expenses"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search maggi, wifi…"
            className="h-11 rounded-xl pl-9"
          />
        </div>
        <Select value={memberId} onValueChange={setMemberId}>
          <SelectTrigger aria-label="Filter by member" className="h-11 w-32 rounded-xl">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Everyone</SelectItem>
            {group?.members.map((m) => (
              <SelectItem key={m.id} value={m.id}>
                {m.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {list.isLoading ? (
        <ListSkeleton rows={6} />
      ) : list.isError ? (
        <ErrorState error={list.error} onRetry={() => list.refetch()} />
      ) : !list.data?.length ? (
        <EmptyState
          emoji="🔍"
          title="No expenses found"
          body={
            q || memberId !== "all"
              ? "Try a different search or filter."
              : "Add your first expense from the Add tab."
          }
        />
      ) : (
        <ul className="space-y-2">
          {list.data.map((e) => (
            <li
              key={e.id}
              className="flex items-center gap-2 rounded-2xl border border-border bg-card shadow-sm"
            >
              <button
                aria-label={`Edit ${e.description}`}
                onClick={() => setEditing(e)}
                className="flex min-h-16 flex-1 items-center gap-3 p-3 text-left"
              >
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-secondary text-xl">
                  {CATEGORY_EMOJI[e.category]}
                </span>
                <span className="flex-1">
                  <span className="block font-semibold">{e.description}</span>
                  <span className="block text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-2">
                      <Avatar name={memberName(group?.members, e.payerId)} />
                      {memberName(group?.members, e.payerId)} paid
                    </span>{" "}
                    · {prettyDate(e.date)} · {e.shares.length} people
                  </span>
                </span>
                <span className="font-display text-lg font-bold">{inr(e.amount)}</span>
              </button>
              <button
                onClick={() => setDeleting(e)}
                aria-label={`Delete ${e.description}`}
                className="mr-1 grid h-11 w-11 place-items-center rounded-xl text-muted-foreground hover:bg-muted hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <ExpenseEditSheet
        expense={editing}
        members={group?.members ?? []}
        onClose={() => setEditing(null)}
      />

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent className="rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{deleting?.description}"?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleting && inr(deleting.amount)} will be removed and balances will update. This
              can't be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
