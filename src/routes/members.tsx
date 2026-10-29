import { createFileRoute } from "@tanstack/react-router";
import { Check, Loader2, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Avatar, EmptyState, ErrorState, ListSkeleton, PageTitle } from "@/components/States";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { addMember, removeMember, updateMember } from "@/lib/api";
import { useGroup, useRefreshAll } from "@/lib/queries";
import type { Member } from "@/lib/types";

export const Route = createFileRoute("/members")({
  head: () => ({
    meta: [
      { title: "Members — Hostel Khata" },
      { name: "description", content: "Add flatmates and set their UPI IDs for one-tap payments." },
      { property: "og:title", content: "Members — Hostel Khata" },
      {
        property: "og:description",
        content: "Add flatmates and set their UPI IDs for one-tap payments.",
      },
    ],
  }),
  component: MembersPage,
});

function MembersPage() {
  const q = useGroup();
  const refresh = useRefreshAll();
  const [name, setName] = useState("");
  const [upi, setUpi] = useState("");
  const [adding, setAdding] = useState(false);

  async function onAdd() {
    if (!name.trim()) return;
    setAdding(true);
    try {
      await addMember(name, upi);
      await refresh();
      toast.success(`${name} added`);
      setName("");
      setUpi("");
    } catch (e) {
      toast.error("Couldn't add", { description: e instanceof Error ? e.message : undefined });
    } finally {
      setAdding(false);
    }
  }

  return (
    <div className="space-y-4">
      <PageTitle title="Members" subtitle="UPI IDs power the Pay via UPI button." />
      {q.isLoading ? (
        <ListSkeleton rows={5} h="h-20" />
      ) : q.isError ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : !q.data?.members.length ? (
        <EmptyState
          emoji="👋"
          title="Your gang starts here"
          body="Add your first flatmate below."
        />
      ) : (
        <div className="space-y-2">
          {q.data!.members.map((m) => (
            <MemberRow key={m.id} m={m} onChanged={refresh} />
          ))}
        </div>
      )}
      <div className="space-y-2 rounded-3xl border border-dashed border-primary/40 bg-card p-4">
        <p className="font-semibold">Add member</p>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          aria-label="Member name"
          placeholder="Name"
          className="h-12 rounded-xl"
        />
        <Input
          value={upi}
          onChange={(e) => setUpi(e.target.value)}
          aria-label="New member UPI ID"
          placeholder="UPI ID (optional) e.g. name@okaxis"
          className="h-12 rounded-xl"
        />
        <Button
          aria-label="Add member"
          className="h-12 w-full rounded-xl"
          onClick={onAdd}
          disabled={!name.trim() || adding}
        >
          {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Add
        </Button>
      </div>
    </div>
  );
}

function MemberRow({ m, onChanged }: { m: Member; onChanged: () => Promise<void> }) {
  const [upi, setUpi] = useState(m.upiId ?? "");
  const [busy, setBusy] = useState(false);
  const [removing, setRemoving] = useState(false);
  const dirty = upi !== (m.upiId ?? "");

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    try {
      await fn();
      await onChanged();
      toast.success(ok);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3 shadow-sm">
      <Avatar name={m.name} />
      <div className="flex-1 space-y-1">
        <p className="font-semibold">{m.name}</p>
        <Input
          aria-label={`${m.name} UPI ID`}
          value={upi}
          onChange={(e) => setUpi(e.target.value)}
          placeholder="Add UPI ID"
          className="h-10 rounded-lg text-sm"
        />
      </div>
      {dirty ? (
        <Button
          size="icon"
          className="h-11 w-11 rounded-xl"
          disabled={busy}
          aria-label={`Save UPI ${m.name}`}
          onClick={() => run(() => updateMember(m.id, { upiId: upi.trim() }), "UPI ID saved")}
        >
          <Check className="h-4 w-4" />
        </Button>
      ) : (
        <Button
          size="icon"
          variant="ghost"
          className="h-11 w-11 rounded-xl"
          disabled={busy}
          aria-label={`Remove member ${m.name}`}
          onClick={() => setRemoving(true)}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      )}
      <AlertDialog open={removing} onOpenChange={setRemoving}>
        <AlertDialogContent className="rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {m.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Members with existing expenses cannot be removed. This removes the member from the
              group.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              onClick={() => run(() => removeMember(m.id), `${m.name} removed`)}
            >
              Remove member
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
