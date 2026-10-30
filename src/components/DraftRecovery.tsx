import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { getDraft, getDraftSource, setDraft, subscribeDraft, useDraft } from "@/lib/draft";
import { loadCheckpoint, storeCheckpoint, type Checkpoint } from "@/lib/recovery";

export function DraftRecovery({ groupId }: { groupId: string }) {
  const [recovered, setRecovered] = useState<Checkpoint | null>(null);
  const [failed, setFailed] = useState(false);
  const current = useDraft();
  const navigate = useNavigate();
  useEffect(() => {
    try {
      setRecovered(loadCheckpoint(window.localStorage, groupId));
    } catch {
      setFailed(true);
    }
    return subscribeDraft(() => {
      const expenses = getDraft();
      try {
        setFailed(
          !storeCheckpoint(window.localStorage, groupId, expenses, getDraftSource(expenses)),
        );
      } catch {
        setFailed(true);
      }
      setRecovered(null);
    });
  }, [groupId]);
  return (
    <>
      {failed && (
        <p role="status" className="mb-4 rounded-2xl border border-border p-3 text-sm">
          Local backup unavailable. Keep this tab open until you save or discard your review.
        </p>
      )}
      {recovered && (
        <section
          aria-label="Recover unsaved review"
          className="mb-5 rounded-3xl border border-primary/30 bg-card p-4"
        >
          <h2 className="font-display text-lg font-bold">Khata yaad hai — unsaved review found</h2>
          <p className="my-2 text-sm text-muted-foreground">
            {recovered.expenses.length} expense(s) stored on this browser. Nothing was added to the
            ledger. Local drafts expire after 7 days. Shared device? Discard when finished.
          </p>
          {!!current.length && (
            <p className="text-sm">
              A current review is open. Finish or discard it before restoring another.
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button
              disabled={!!current.length}
              onClick={() => {
                setDraft(recovered.expenses, recovered.source);
                setRecovered(null);
                void navigate({ to: "/review" });
              }}
            >
              Restore review
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                try {
                  setFailed(!storeCheckpoint(window.localStorage, groupId, []));
                } catch {
                  setFailed(true);
                }
                setRecovered(null);
              }}
            >
              Discard backup
            </Button>
          </div>
        </section>
      )}
    </>
  );
}
