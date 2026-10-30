import { createFileRoute } from "@tanstack/react-router";
import { ArrowRight, Copy, QrCode, Smartphone } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useState } from "react";
import { toast } from "sonner";
import { Avatar, EmptyState, ErrorState, ListSkeleton, PageTitle } from "@/components/States";
import { Money } from "@/components/Money";
import { ReminderSheet } from "@/components/ReminderSheet";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { buildUpiLink, inr } from "@/lib/format";
import { useGroup, useSettlements, useRefreshAll } from "@/lib/queries";
import { claimPayment, receiveCash } from "@/lib/api";
import { PaymentInbox } from "@/components/PaymentInbox";
import { Input } from "@/components/ui/input";
import { useAccount } from "@/lib/account-context";
import type { Member } from "@/lib/types";

export const Route = createFileRoute("/settle")({
  head: () => ({
    meta: [
      { title: "Settle up — Hostel Khata" },
      {
        name: "description",
        content: "Simplified payments to clear all dues, with UPI links and QR codes.",
      },
      { property: "og:title", content: "Settle up — Hostel Khata" },
      {
        property: "og:description",
        content: "Simplified payments to clear all dues, with UPI links and QR codes.",
      },
    ],
  }),
  component: SettlePage,
});

function SettlePage() {
  const { data: group } = useGroup();
  const { session } = useAccount();
  const [amount, setAmount] = useState("");
  const [upiRef, setUpiRef] = useState("");
  const [note, setNote] = useState("");
  const q = useSettlements();
  const refresh = useRefreshAll();
  const [recording, setRecording] = useState(false);
  const [payment, setPayment] = useState<{ from: Member; to: Member; amount: number } | null>(null);
  const [qr, setQr] = useState<{ link: string; to: Member; amount: number } | null>(null);
  const [reminder, setReminder] = useState<{ from: Member; to: Member; amount: number } | null>(
    null,
  );
  const find = (id: string) => group?.members.find((m) => m.id === id);

  return (
    <div>
      <PageTitle title="Settle up" subtitle="Simplest way to clear everyone's dues." />
      {session?.user?.demoExpiresAt && (
        <p role="status" className="my-3 rounded-xl bg-secondary p-3">
          Demo sandbox: sample UPI IDs are fictitious. Do not send money to them. Use two real
          accounts to test receiver confirmation.
        </p>
      )}
      <PaymentInbox />
      {q.isLoading || !group ? (
        <ListSkeleton rows={4} h="h-32" />
      ) : q.isError ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : !q.data?.length ? (
        <EmptyState
          emoji="🤝"
          title="All settled"
          body="No payments needed. Chai pe charcha?"
          celebrate
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {q.data.map((s, i) => {
            const from = find(s.fromId);
            const to = find(s.toId);
            if (!from || !to) return null;
            const link = to.upiId ? buildUpiLink(to.upiId, to.name, s.amount) : "";
            return (
              <div key={i} className="rounded-3xl border border-border bg-card p-4 shadow-sm">
                <div className="flex flex-wrap items-center gap-2 text-base">
                  <Avatar name={from.name} />
                  <span className="font-semibold">{from.name}</span>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  <Avatar name={to.name} />
                  <span className="font-semibold">{to.name}</span>
                  <span className="ml-auto font-display text-xl font-bold text-primary">
                    <Money amount={s.amount} />
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">
                  {from.name} pays {to.name} {inr(s.amount)}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {to.upiId && !session?.user?.demoExpiresAt ? (
                    <>
                      <Button
                        asChild
                        className="h-12 flex-1 rounded-xl md:order-2"
                        disabled={from.userId !== session?.user?.id}
                      >
                        <a href={link} aria-label={`Pay via UPI ${from.name} to ${to.name}`}>
                          <Smartphone className="h-4 w-4" /> Pay via UPI
                        </a>
                      </Button>
                      <Button
                        aria-label={`Show QR ${from.name} to ${to.name}`}
                        variant="outline"
                        className="h-12 flex-1 rounded-xl md:order-1 md:bg-primary md:text-primary-foreground"
                        onClick={() => setQr({ link, to, amount: s.amount })}
                      >
                        <QrCode className="h-4 w-4" /> Show QR
                      </Button>
                    </>
                  ) : (
                    <Button
                      variant="secondary"
                      className="h-12 flex-1 rounded-xl"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(
                            `Hi ${from.name}, please pay ${to.name} ${inr(s.amount)} for ${group.name} expenses (Hostel Khata). ${to.name}, share your UPI ID!`,
                          );
                          toast.success("Payment message copied");
                        } catch {
                          toast.error("Couldn't copy. Check clipboard permission and try again.");
                        }
                      }}
                    >
                      <Copy className="h-4 w-4" /> Ask {to.name} to add UPI ID
                    </Button>
                  )}
                </div>
                <Button
                  aria-label={`Send reminder ${from.name} to ${to.name}`}
                  variant="secondary"
                  className="mt-3 min-h-11 w-full rounded-xl"
                  onClick={() => setReminder({ from, to, amount: s.amount })}
                >
                  Send reminder
                </Button>
                {(from.userId === session?.user?.id || to.userId === session?.user?.id) &&
                  from.status !== "removed" &&
                  to.status !== "removed" && (
                    <Button
                      variant="outline"
                      className="mt-2 min-h-11 w-full rounded-xl"
                      onClick={() => {
                        setAmount(String(s.amount));
                        setUpiRef("");
                        setNote("");
                        setPayment({ from, to, amount: s.amount });
                      }}
                    >
                      {from.userId === session?.user?.id ? "I've paid" : "Received in cash"}
                    </Button>
                  )}
                {(from.status === "removed" || to.status === "removed") && (
                  <p className="mt-2 text-sm text-muted-foreground">
                    A former member is involved. Ask an admin to approve their return before
                    recording a payment.
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
      {reminder && <ReminderSheet {...reminder} onClose={() => setReminder(null)} />}
      <Dialog open={!!qr} onOpenChange={(o) => !o && setQr(null)}>
        <DialogContent className="max-w-sm rounded-3xl">
          <DialogHeader>
            <DialogTitle>
              Pay {qr?.to.name} {qr && inr(qr.amount)}
            </DialogTitle>
            <DialogDescription>Scan with any UPI app — {qr?.to.upiId}</DialogDescription>
          </DialogHeader>
          {qr && (
            <div className="mx-auto rounded-2xl bg-white p-4">
              <QRCodeSVG value={qr.link} size={220} />
            </div>
          )}
        </DialogContent>
      </Dialog>
      <Dialog open={!!payment} onOpenChange={(open) => !recording && !open && setPayment(null)}>
        <DialogContent className="max-w-sm rounded-3xl">
          <DialogHeader>
            <DialogTitle>
              {payment?.to.userId === session?.user?.id
                ? "Confirm cash received?"
                : "Submit payment claim?"}
            </DialogTitle>
            <DialogDescription>
              {payment &&
                `${payment.from.name} paid ${payment.to.name} ${inr(payment.amount)}. A claim stays pending until the receiver confirms. Record cash only if you personally received it.`}
            </DialogDescription>
          </DialogHeader>
          <label className="space-y-1 text-sm">
            Amount (maximum {payment && inr(payment.amount)})
            <Input
              type="number"
              min="0.01"
              step="0.01"
              max={payment?.amount}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </label>
          {payment?.from.userId === session?.user?.id && (
            <label className="space-y-1 text-sm">
              UPI reference / UTR (optional)
              <Input value={upiRef} maxLength={100} onChange={(e) => setUpiRef(e.target.value)} />
            </label>
          )}
          <label className="space-y-1 text-sm">
            Note (optional)
            <Input value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} />
          </label>
          <Button
            disabled={recording}
            onClick={async () => {
              if (!payment) return;
              setRecording(true);
              try {
                const input = {
                  fromUserId: payment.from.userId!,
                  toUserId: payment.to.userId!,
                  amount: Number(amount),
                  upiRef,
                  note,
                };
                if (
                  !Number.isFinite(input.amount) ||
                  input.amount <= 0 ||
                  input.amount > payment.amount
                )
                  throw new Error("Enter an amount within the unpaid balance.");
                if (payment.to.userId === session?.user?.id) await receiveCash(input);
                else await claimPayment(input);
                setPayment(null);
                await refresh();
                toast.success(
                  payment.to.userId === session?.user?.id
                    ? "Cash received and recorded"
                    : "Claim sent. Waiting for receiver confirmation.",
                );
              } catch (error) {
                toast.error(error instanceof Error ? error.message : "Couldn't record payment");
              } finally {
                setRecording(false);
              }
            }}
          >
            {recording
              ? "Submitting…"
              : payment?.to.userId === session?.user?.id
                ? "Yes, cash received"
                : "Send for receiver confirmation"}
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
