import { useContext, useEffect, useRef, useState } from "react";
import { useLocation } from "@tanstack/react-router";
import { Volume2, Scale } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { getGroup, getBalances, getSettlements } from "@/lib/api";
import { groupBriefing, nextPayers } from "@/lib/group-insights";
import { VoiceContext } from "@/lib/voice-context";
import { inr } from "@/lib/format";

export function GroupTools() {
  const voice = useContext(VoiceContext);
  const { pathname } = useLocation();
  const [mode, setMode] = useState<"next" | "brief" | null>(null);
  const [busy, setBusy] = useState(false);
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [speechStatus, setSpeechStatus] = useState("");
  const [speaking, setSpeaking] = useState(false);
  const request = useRef(0);
  const utterance = useRef<SpeechSynthesisUtterance | null>(null);
  const stopSpeech = () => {
    if (utterance.current) {
      utterance.current.onend = null;
      utterance.current.onerror = null;
      window.speechSynthesis?.cancel();
      utterance.current = null;
    }
    setSpeaking(false);
  };
  const close = () => {
    request.current++;
    stopSpeech();
    setMode(null);
  };
  useEffect(() => {
    const invalidate = () => {
      request.current++;
    };
    request.current++;
    setMode(null);
    setSpeaking(false);
    return () => {
      invalidate();
      if (utterance.current) {
        utterance.current.onend = null;
        utterance.current.onerror = null;
        window.speechSynthesis?.cancel();
        utterance.current = null;
      }
    };
  }, [pathname]);
  useEffect(() => {
    const hidden = () => {
      if (document.hidden) {
        request.current++;
        stopSpeech();
        setBusy(false);
        setMode(null);
      }
    };
    document.addEventListener("visibilitychange", hidden);
    return () => document.removeEventListener("visibilitychange", hidden);
  }, []);
  function read(message: string) {
    stopSpeech();
    voice?.stop();
    if (
      typeof window.speechSynthesis?.speak !== "function" ||
      typeof SpeechSynthesisUtterance === "undefined"
    ) {
      setSpeechStatus("Audio unavailable in this browser. Read or copy the briefing below.");
      return;
    }
    try {
      const next = new SpeechSynthesisUtterance(message);
      next.lang = "en-IN";
      next.rate = 0.95;
      next.onend = () => {
        utterance.current = null;
        setSpeaking(false);
        setSpeechStatus("Briefing complete. Start voice to use commands again.");
      };
      next.onerror = () => {
        utterance.current = null;
        setSpeaking(false);
        setSpeechStatus("Audio could not play. Tap Read aloud or copy the text.");
      };
      utterance.current = next;
      setSpeaking(true);
      setSpeechStatus("Mic paused while reading. Start voice again after the briefing.");
      window.speechSynthesis.speak(next);
    } catch {
      setSpeaking(false);
      setSpeechStatus("Audio unavailable. The text below is still ready.");
    }
  }
  async function open(kind: "next" | "brief") {
    stopSpeech();
    const id = ++request.current;
    setMode(kind);
    setBusy(true);
    setText("");
    setError("");
    setSpeechStatus("");
    try {
      const [group, balances, settlements] = await Promise.all([
        getGroup(),
        getBalances(),
        getSettlements(),
      ]);
      if (id !== request.current) return;
      const briefing = groupBriefing(group, balances, settlements);
      const suggested = nextPayers(group, balances);
      const message =
        kind === "brief"
          ? briefing
          : !suggested.length
            ? "Sab barabar! Anyone can volunteer for the next shared buy."
            : suggested.map((m) => m.name).join(" or ") +
              " could pay next. " +
              (suggested.length > 1 ? "They are tied at " : "Current net dues: ") +
              inr(suggested[0]!.owedPaise / 100) +
              " each. This is the largest amount owed, not a spending target. Only volunteer if comfortable; a purchase still needs its own confirmed expense.";
      setText(message);
      if (kind === "brief") read(message);
    } catch (e) {
      if (id === request.current)
        setError(e instanceof Error ? e.message : "Could not load group balances.");
    } finally {
      if (id === request.current) setBusy(false);
    }
  }
  return (
    <>
      <div className="mb-5 flex flex-wrap gap-2" aria-label="Group shortcuts">
        <Button variant="outline" className="rounded-full" onClick={() => void open("next")}>
          <Scale size={16} />
          Who should pay next
        </Button>
        <Button variant="outline" className="rounded-full" onClick={() => void open("brief")}>
          <Volume2 size={16} />
          Listen to group briefing
        </Button>
      </div>
      <Sheet
        open={!!mode}
        onOpenChange={(open) => {
          if (!open) close();
        }}
      >
        <SheetContent
          side="bottom"
          className="mx-auto max-h-[85dvh] max-w-xl overflow-y-auto rounded-t-3xl"
        >
          <SheetHeader>
            <SheetTitle>
              {mode === "next" ? "Agla shared buy, kaun pay kare?" : "Flat ka spoken briefing"}
            </SheetTitle>
            <SheetDescription>
              Current group balances. Suggestions never record a payment.
            </SheetDescription>
          </SheetHeader>
          {busy ? (
            <p role="status">Loading fresh balances…</p>
          ) : error ? (
            <div role="alert">
              <p>{error}</p>
              <Button onClick={() => void open(mode ?? "brief")}>Retry</Button>
            </div>
          ) : (
            <>
              <p className="whitespace-pre-line text-sm leading-7">{text}</p>
              <p role="status" className="text-xs text-muted-foreground">
                {speechStatus}
              </p>
              <div className="flex flex-wrap gap-2">
                {speaking ? (
                  <Button onClick={stopSpeech}>Stop reading</Button>
                ) : (
                  <Button onClick={() => read(text)}>Read aloud</Button>
                )}
                <Button
                  variant="outline"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(text);
                      setSpeechStatus("Copied briefing.");
                    } catch {
                      setSpeechStatus("Copy unavailable. Select and copy the visible text.");
                    }
                  }}
                >
                  Copy briefing
                </Button>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
