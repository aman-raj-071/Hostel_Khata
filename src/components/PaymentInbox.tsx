import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { listPayments, decidePayment, type Payment } from "@/lib/api";
import { useAccount } from "@/lib/account-context";
import { useGroup } from "@/lib/queries";
import { inr } from "@/lib/format";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ErrorState, ListSkeleton } from "@/components/States";

export function PaymentBell() {
  const { session } = useAccount();
  const q = useQuery({ queryKey: ["payments"], queryFn: listPayments, refetchInterval: 15000 });
  const g = useGroup().data;
  const count =
    q.data?.filter(
      (p) =>
        (p.status === "pending" && p.toUserId === session?.user?.id) ||
        (p.status === "disputed" && (p.fromUserId === session?.user?.id || g?.myRole === "admin")),
    ).length ?? 0;
  return (
    <Link
      to="/settle"
      className="relative grid h-11 w-11 place-items-center rounded-xl hover:bg-muted"
      aria-label={
        q.isError
          ? "Payment notifications unavailable — open Settle"
          : "Payment notifications: " + count
      }
    >
      <Bell size={19} />
      {count > 0 && (
        <span className="absolute right-0 top-0 rounded-full bg-primary px-1.5 text-xs text-primary-foreground">
          {count}
        </span>
      )}
    </Link>
  );
}

export function PaymentInbox() {
  const { session } = useAccount();
  const { data: group } = useGroup();
  const client = useQueryClient();
  const q = useQuery({ queryKey: ["payments"], queryFn: listPayments, refetchInterval: 15000 });
  const [decision, setDecision] = useState<{
    payment: Payment;
    action: "confirm" | "dispute" | "cancel";
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const name = (id: string) => group?.members.find((m) => m.userId === id)?.name ?? "Former member";
  return (
    <section
      className="my-6 rounded-3xl border border-border bg-card p-4"
      aria-label="Confirm payments"
    >
      <h2 className="font-display text-xl font-semibold">Confirm payments</h2>
      <p className="text-sm text-muted-foreground">
        Check your bank or cash receipt before confirming. Opening UPI or a QR never confirms a
        payment.
      </p>
      {q.isError ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : q.isPending ? (
        <ListSkeleton rows={2} />
      ) : !q.data?.length ? (
        <p className="py-4 text-sm text-muted-foreground">No payment claims yet.</p>
      ) : (
        <div className="divide-y divide-border">
          {q.data.map((p) => (
            <div key={p.id} className="py-4 space-y-2">
              <p className="font-medium">
                {name(p.fromUserId)} → {name(p.toUserId)} · {inr(p.amount)}
              </p>
              <p className="text-sm capitalize">
                {p.status}
                {p.upiRef && " · UTR: " + p.upiRef}
              </p>
              {p.note && <p className="text-sm text-muted-foreground">{p.note}</p>}
              {p.status === "pending" && (
                <div className="flex flex-wrap gap-2">
                  {p.toUserId === session?.user?.id && (
                    <>
                      <Button onClick={() => setDecision({ payment: p, action: "confirm" })}>
                        Confirm received
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => setDecision({ payment: p, action: "dispute" })}
                      >
                        Dispute
                      </Button>
                    </>
                  )}
                  {p.fromUserId === session?.user?.id && (
                    <Button
                      variant="outline"
                      onClick={() => setDecision({ payment: p, action: "cancel" })}
                    >
                      Cancel pending payment
                    </Button>
                  )}
                </div>
              )}
              {p.status === "disputed" && (
                <p role="status" className="text-sm text-destructive">
                  Disputed — payer and admin can see this notice. Balances have not changed. Discuss
                  it before submitting a new claim.
                </p>
              )}
            </div>
          ))}
        </div>
      )}
      <Dialog open={!!decision} onOpenChange={(open) => !open && !busy && setDecision(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {decision?.action === "confirm"
                ? "Confirm money received?"
                : decision?.action === "dispute"
                  ? "Dispute this payment?"
                  : "Cancel this claim?"}
            </DialogTitle>
            <DialogDescription>
              {decision?.action === "confirm"
                ? "Only confirm after verifying receipt. This records a settlement and updates balances."
                : "This keeps balances unchanged."}
            </DialogDescription>
          </DialogHeader>
          <Button
            disabled={busy}
            onClick={async () => {
              if (!decision) return;
              setBusy(true);
              try {
                await decidePayment(decision.payment.id, decision.action);
                setDecision(null);
                await client.invalidateQueries();
                toast.success("Payment updated");
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "Couldn't update payment");
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? "Updating…" : "Confirm action"}
          </Button>
        </DialogContent>
      </Dialog>
    </section>
  );
}
