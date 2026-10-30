import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { getGroup, getBalances } from "@/lib/api";
import { nextPayers } from "@/lib/group-insights";
import { inr } from "@/lib/format";

export function GroupTools() {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function suggest() {
    setOpen(true);
    setBusy(true);
    setError("");
    try {
      const [group, balances] = await Promise.all([getGroup(), getBalances()]);
      const suggested = nextPayers(group, balances);
      setText(
        !suggested.length
          ? "Sab barabar! Anyone can volunteer for the next shared buy."
          : suggested.map((m) => m.name).join(" or ") +
              " could pay next. Current net dues: " +
              inr(suggested[0]!.owedPaise / 100) +
              ". This is an optional suggestion, not a payment or spending target.",
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load balances.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="mb-5">
        <Button variant="outline" className="rounded-full" onClick={() => void suggest()}>
          Who should pay next
        </Button>
      </div>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="bottom"
          className="mx-auto max-h-[85dvh] max-w-xl overflow-y-auto rounded-t-3xl"
        >
          <SheetHeader>
            <SheetTitle>Agla shared buy, kaun pay kare?</SheetTitle>
            <SheetDescription>
              Based on current group balances. No payment is recorded.
            </SheetDescription>
          </SheetHeader>
          {busy ? (
            <p role="status">Loading balances…</p>
          ) : error ? (
            <div role="alert">
              <p>{error}</p>
              <Button onClick={() => void suggest()}>Retry</Button>
            </div>
          ) : (
            <p className="text-sm leading-7">{text}</p>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
