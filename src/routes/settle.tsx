import { createFileRoute } from "@tanstack/react-router";
import { ArrowRight, Copy, QrCode, Smartphone } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useState } from "react";
import { toast } from "sonner";
import { Avatar, EmptyState, ErrorState, ListSkeleton, PageTitle } from "@/components/States";
import { Money } from "@/components/Money";
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
import { saveExpenses } from "@/lib/api";
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
  const q = useSettlements();
  const refresh = useRefreshAll();
  const [recording, setRecording] = useState(false);
  const [payment, setPayment] = useState<{ from: Member; to: Member; amount: number } | null>(null);
  const [qr, setQr] = useState<{ link: string; to: Member; amount: number } | null>(null);
  const find = (id: string) => group?.members.find((m) => m.id === id);

  return (
    <div>
      <PageTitle title="Settle up" subtitle="Simplest way to clear everyone's dues." />
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
                <div className="mt-3 flex gap-2">
                  {to.upiId ? (
                    <>
                      <Button asChild className="h-12 flex-1 rounded-xl">
                        <a href={link} aria-label={`Pay via UPI ${from.name} to ${to.name}`}>
                          <Smartphone className="h-4 w-4" /> Pay via UPI
                        </a>
                      </Button>
                      <Button
                        aria-label={`Show QR ${from.name} to ${to.name}`}
                        variant="outline"
                        className="h-12 flex-1 rounded-xl"
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
                            `Hi ${from.name}, please pay ${to.name} ${inr(s.amount)} for Flat 302 expenses (Hostel Khata). ${to.name}, share your UPI ID!`,
                          );
                          toast.success("Payment message copied");
                        } catch {
                          toast.error("Couldn't copy. Check clipboard permission and try again.");
                        }
                      }}
                    >
                      <Copy className="h-4 w-4" /> Copy payment message
                    </Button>
                  )}
                </div>
                <Button
                  aria-label={`Record payment ${from.name} to ${to.name}`}
                  variant="outline"
                  className="mt-2 min-h-11 w-full rounded-xl"
                  onClick={() => setPayment({ from, to, amount: s.amount })}
                >
                  Record payment
                </Button>
              </div>
            );
          })}
        </div>
      )}
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
            <DialogTitle>Record completed payment?</DialogTitle>
            <DialogDescription>
              {payment &&
                `${payment.from.name} paid ${payment.to.name} ${inr(payment.amount)}. Confirm only after the payment succeeds. This updates everyone's balances.`}
            </DialogDescription>
          </DialogHeader>
          <Button
            disabled={recording}
            onClick={async () => {
              if (!payment) return;
              setRecording(true);
              try {
                await saveExpenses([
                  {
                    payer: payment.from.name,
                    amount: payment.amount,
                    description: "Settlement",
                    category: "other",
                    date: new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(
                      new Date(),
                    ),
                    splitType: "exact",
                    participants: [payment.to.name],
                    shares: [{ member: payment.to.name, amount: payment.amount }],
                    confidence: 1,
                    needsClarification: false,
                    question: null,
                  },
                ]);
                setPayment(null);
                await refresh();
                toast.success("Payment recorded");
              } catch (error) {
                toast.error(error instanceof Error ? error.message : "Couldn't record payment");
              } finally {
                setRecording(false);
              }
            }}
          >
            {recording ? "Recording…" : "Yes, payment completed"}
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
