import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Loader2, Sparkles } from "lucide-react";
import { useState } from "react";
import { KhataMascot } from "@/components/KhataMascot";
import { RecurringTemplates } from "@/components/RecurringTemplates";
import { toast } from "sonner";
import { Avatar, PageTitle } from "@/components/States";
import { useGroup } from "@/lib/queries";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { parseText } from "@/lib/api";
import { setDraft } from "@/lib/draft";
import type { ParseMode } from "@/lib/types";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Add expense — Hostel Khata" },
      {
        name: "description",
        content: "Speak or paste WhatsApp chat in Hinglish to log shared flat expenses.",
      },
      { property: "og:title", content: "Add expense — Hostel Khata" },
      {
        property: "og:description",
        content: "Speak or paste WhatsApp chat in Hinglish to log shared flat expenses.",
      },
    ],
  }),
  component: AddPage,
});

const EXAMPLES: Record<ParseMode, string[]> = {
  "brain-dump": [
    "Maine 600 ka dinner kiya, Aman aur Riya ke saath split",
    "Raat ko maggi 120 Riya ne li, usme Aman nahi tha",
  ],
  "chat-import": [
    "28/10/26, 9:12 pm - Dev: bhai swiggy 840 ka order kiya\n28/10/26, 9:30 pm - Sneha: doodh 84 laayi",
    "29/10/26, 8:05 am - Kabir: auto 150 diya station tak",
  ],
};

function AddPage() {
  const [text, setText] = useState("");
  const [mode, setMode] = useState<ParseMode>("brain-dump");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { data: group } = useGroup();

  async function onParse() {
    setLoading(true);
    try {
      const { expenses } = await parseText(text, mode);
      if (!expenses.length) {
        toast.error("Koi amount nahi mila", { description: "Try including a number like ₹250." });
        return;
      }
      setDraft(expenses, text);
      navigate({ to: "/review" });
    } catch (e) {
      toast.error("Parsing failed", { description: e instanceof Error ? e.message : undefined });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <section className="expense-hero relative overflow-hidden rounded-[2rem] border border-border px-5 py-8 text-center md:py-12">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[.22em] text-primary">
          Less hisaab. More hostel.
        </p>
        <PageTitle
          title="Kya kharcha hua?"
          subtitle="Wispr Flow se bolo, type karo, ya WhatsApp chat paste karo."
        />
        <p className="mt-4 text-sm text-muted-foreground">
          Review karo, phir save — control tumhare haath mein.
        </p>
        <div className="absolute right-3 top-3 hidden rotate-12 opacity-80 sm:block">
          <KhataMascot small />
        </div>
      </section>
      {group && (
        <div
          className="flex flex-wrap items-center justify-center gap-2"
          aria-label="Your flatmates"
        >
          <span className="mr-2 text-xs text-muted-foreground">Your gang</span>
          {group.members.map((member) => (
            <div
              key={member.id}
              className="flex items-center gap-2 rounded-full border border-border bg-card py-1 pl-1 pr-3"
            >
              <Avatar name={member.name} />
              <span className="text-xs">{member.name}</span>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center gap-4 text-xs uppercase tracking-widest text-muted-foreground">
        <span className="h-px flex-1 bg-border" />
        or type / paste chat
        <span className="h-px flex-1 bg-border" />
      </div>

      {!text.trim() && <RecurringTemplates />}

      <div className="grid grid-cols-2 rounded-2xl bg-muted p-1" role="tablist">
        {(["brain-dump", "chat-import"] as const).map((m) => (
          <button
            key={m}
            role="tab"
            aria-selected={mode === m}
            onClick={() => setMode(m)}
            className={`h-11 rounded-xl text-sm font-semibold transition ${
              mode === m ? "bg-card text-primary shadow-sm" : "text-muted-foreground"
            }`}
          >
            {m === "brain-dump" ? "Brain-dump" : "Chat import"}
          </button>
        ))}
      </div>

      <Textarea
        aria-label="Expense text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        autoFocus
        onKeyDown={(event) => {
          if (
            (event.ctrlKey || event.metaKey) &&
            event.key === "Enter" &&
            !event.nativeEvent.isComposing
          ) {
            event.preventDefault();
            if (text.trim() && !loading) void onParse();
          }
        }}
        placeholder="Hold Fn (Wispr Flow) and speak your expenses, or paste WhatsApp chat"
        className="min-h-64 rounded-3xl bg-card p-5 text-base shadow-sm"
      />

      <div className="flex flex-wrap gap-2">
        {EXAMPLES[mode].map((ex) => (
          <button
            key={ex}
            onClick={() => setText(ex)}
            className="min-h-11 rounded-full border border-border bg-card px-4 py-2 text-left text-sm text-secondary-foreground hover:bg-secondary"
          >
            {ex.split("\n")[0]?.slice(0, 60)}
            {ex.length > 60 ? "…" : ""}
          </button>
        ))}
      </div>

      <Button
        size="lg"
        className="h-14 w-full rounded-2xl text-base font-semibold"
        disabled={!text.trim() || loading}
        onClick={onParse}
      >
        {loading ? (
          <>
            <Loader2 className="h-5 w-5 animate-spin" /> Samajh rahe hain…
          </>
        ) : (
          <>
            <Sparkles className="h-5 w-5" /> Parse
          </>
        )}
      </Button>
    </div>
  );
}
