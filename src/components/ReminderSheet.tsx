import { useEffect, useState } from "react";
import { Copy, MessageCircle, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ListSkeleton } from "@/components/States";
import { generateReminder } from "@/lib/api";
import { inr } from "@/lib/format";
import type { Member, ReminderTone } from "@/lib/types";

export function ReminderSheet({
  from,
  to,
  amount,
  onClose,
}: {
  from: Member;
  to: Member;
  amount: number;
  onClose: () => void;
}) {
  const [tone, setTone] = useState<ReminderTone>("polite");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let closed = false;
    setLoading(true);
    setError("");
    setMessage("");
    generateReminder({ fromId: from.id, toId: to.id, amount, tone })
      .then((result) => {
        if (!closed) setMessage(result.message);
      })
      .catch((error) => {
        if (!closed)
          setError(error instanceof Error ? error.message : "Couldn't generate the reminder.");
      })
      .finally(() => {
        if (!closed) setLoading(false);
      });
    return () => {
      closed = true;
    };
  }, [from.id, to.id, amount, tone, attempt]);

  return (
    <Sheet
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <SheetContent
        side="bottom"
        className="mx-auto max-h-[90dvh] max-w-xl overflow-y-auto rounded-t-3xl pb-8"
      >
        <SheetHeader>
          <SheetTitle>Thoda pyaar se ya thoda filmy?</SheetTitle>
          <SheetDescription>
            Remind {from.name} to pay {to.name} {inr(amount)}. Edit before sharing.
          </SheetDescription>
        </SheetHeader>
        <div className="my-5 grid grid-cols-4 gap-2" role="group" aria-label="Reminder tone">
          {(
            [
              ["polite", "🙂"],
              ["filmy", "🎬"],
              ["mummy", "😌"],
              ["savage", "🔥"],
            ] as const
          ).map(([value, emoji]) => (
            <button
              key={value}
              aria-pressed={tone === value}
              disabled={loading}
              onClick={() => {
                setMessage("");
                setLoading(true);
                setTone(value);
                if (tone === value) setAttempt(attempt + 1);
              }}
              className={`min-h-14 rounded-2xl border p-2 text-sm capitalize disabled:opacity-60 ${tone === value ? "border-primary bg-secondary text-secondary-foreground" : "border-border bg-card"}`}
            >
              <span aria-hidden="true">{emoji} </span>
              {value}
            </button>
          ))}
        </div>
        {loading ? (
          <div role="status" aria-label="Generating reminder">
            <ListSkeleton rows={3} />
            <p className="mt-2 text-sm text-muted-foreground">Reminder likh rahe hain…</p>
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-destructive/30 bg-card p-4">
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
            <Button variant="outline" className="mt-3" onClick={() => setAttempt(attempt + 1)}>
              Try again
            </Button>
          </div>
        ) : (
          <>
            <Textarea
              aria-label="Reminder message"
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              maxLength={600}
              className="min-h-40 rounded-2xl bg-card p-4 text-base"
            />
            {!message.trim() && (
              <p className="mt-2 text-sm text-muted-foreground">Write a message to share.</p>
            )}
            <div className="mt-4 grid grid-cols-2 gap-2">
              <Button
                asChild
                disabled={!message.trim()}
                className="h-auto min-h-12 whitespace-normal rounded-xl"
              >
                <a
                  aria-disabled={!message.trim()}
                  href={
                    message.trim()
                      ? `https://wa.me/?text=${encodeURIComponent(message.trim())}`
                      : undefined
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(event) => {
                    if (!message.trim()) event.preventDefault();
                  }}
                >
                  <MessageCircle className="shrink-0" />
                  Send on WhatsApp
                </a>
              </Button>
              <Button
                variant="outline"
                disabled={!message.trim()}
                className="min-h-12 rounded-xl"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(message.trim());
                    toast.success("Reminder copied");
                  } catch {
                    toast.error("Couldn't copy. Select the message and copy it manually.");
                  }
                }}
              >
                <Copy />
                Copy
              </Button>
            </div>
            <Button variant="ghost" className="mt-2 w-full" onClick={() => setAttempt(attempt + 1)}>
              <RefreshCw />
              Generate again
            </Button>
          </>
        )}
        <p className="mt-3 text-xs text-muted-foreground">
          WhatsApp opens a draft. Choose the recipient and send it there.
        </p>
      </SheetContent>
    </Sheet>
  );
}
