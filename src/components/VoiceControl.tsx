import { useLocation, useNavigate } from "@tanstack/react-router";
import { CircleHelp, Mic, MicOff } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { VoiceContext } from "@/lib/voice-context";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { speechConstructor, useSpeechRecognition } from "@/hooks/use-speech-recognition";
import {
  activateVoiceTarget,
  findVoiceTarget,
  getVoiceInput,
  getVoiceTargets,
  parseVoiceCommand,
  scrollVoicePage,
  voiceWords,
  writeVoiceInput,
  type VoiceTarget,
} from "@/lib/voice";

export function VoiceControl({ children }: { children?: ReactNode }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [language, setLanguage] = useState("en-IN");
  const [supported, setSupported] = useState(false);
  useEffect(() => {
    setSupported(Boolean(speechConstructor()));
  }, []);
  const [help, setHelp] = useState(false);
  const [message, setMessage] = useState("Bolo: “balances kholo”, “click 5”, “likho …”");
  const [heard, setHeard] = useState("");
  const [dictating, setDictating] = useState(false);
  const dictation = useRef(false);
  const dictationField = useRef<ReturnType<typeof getVoiceInput> | null>(null);
  const targets = useRef<VoiceTarget[]>([]);
  const stopRef = useRef<() => void>(() => {});
  const [badges, setBadges] = useState<{ number: number; x: number; y: number }[]>([]);

  const handleCommand = useCallback(
    (text: string) => {
      if (!text) return;
      setHeard(text);
      const command = parseVoiceCommand(text);
      try {
        if (command.kind === "stop") {
          dictation.current = false;
          setDictating(false);
          stopRef.current();
          setMessage("Mic band hai.");
          return;
        }
        if (command.kind === "end-dictation") {
          dictation.current = false;
          setDictating(false);
          setMessage("Ab commands bolo, jaise “parse karo”.");
          return;
        }
        if (dictation.current) {
          const field = dictationField.current;
          if (!field || !getVoiceTargets().some((target) => target.element === field)) {
            dictation.current = false;
            setDictating(false);
            throw new Error("Field badal gayi. Nayi field chuno aur “likhna shuru” dobara bolo.");
          }
          setMessage(writeVoiceInput(field, text, true));
          return;
        }
        switch (command.kind) {
          case "back":
            if (window.history.length > 1) window.history.back();
            else void navigate({ to: "/" });
            setMessage("Wapas ja rahe hain.");
            break;
          case "navigate":
            void navigate({ to: command.to }).catch(() =>
              setMessage("Page nahi khula. Dobara try karo."),
            );
            setMessage(`${command.to === "/" ? "Add" : command.to.slice(1)} khol rahe hain.`);
            break;
          case "click":
            setMessage(
              activateVoiceTarget(
                findVoiceTarget(
                  /^\d+$/.test(command.target) ? targets.current : getVoiceTargets(),
                  command.target,
                ),
              ),
            );
            break;
          case "write":
          case "search":
            setMessage(
              writeVoiceInput(
                getVoiceInput(getVoiceTargets(), command.kind === "search"),
                command.text,
              ),
            );
            break;
          case "clear":
            setMessage(writeVoiceInput(getVoiceInput(getVoiceTargets()), ""));
            break;
          case "dictate":
            dictationField.current = getVoiceInput(getVoiceTargets());
            if (
              dictationField.current instanceof HTMLSelectElement ||
              (dictationField.current instanceof HTMLInputElement &&
                ["number", "date"].includes(dictationField.current.type))
            )
              throw new Error("Is field ke liye “likho” ke baad poori value bolo.");
            dictationField.current.focus();
            dictation.current = true;
            setDictating(true);
            setMessage("Kharcha bolo. Commands ke liye “likhna band” bolo.");
            break;
          case "scroll":
            scrollVoicePage(command.direction);
            setMessage(
              command.direction === "down" ? "Neeche ja rahe hain." : "Upar ja rahe hain.",
            );
            break;
          case "help":
            setHelp((open) => !open);
            setMessage("Voice commands neeche diye hain.");
            break;
          case "confirm":
          case "cancel": {
            const all = getVoiceTargets();
            const dialog = all.filter((t) =>
              t.element.closest('[role="dialog"],[role="alertdialog"]'),
            );
            const scope = dialog.length ? dialog : all;
            const pattern =
              command.kind === "confirm"
                ? /^(yes payment completed|delete|remove member|confirm payer amount and split|save all|save changes)$/
                : /^(cancel|close|discard)$/;
            const matches = scope.filter((t) => pattern.test(voiceWords(t.label)));
            if (matches.length !== 1)
              throw new Error("Confirmation ka button number bolo, jaise “click 5”.");
            setMessage(activateVoiceTarget(matches[0]!));
            break;
          }
          case "unknown":
            setMessage("Command nahi samjha. “help”, “balances kholo” ya “click 5” bolo.");
            break;
        }
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Command nahi chala. Dobara try karo.");
      }
    },
    [navigate],
  );

  const speech = useSpeechRecognition(handleCommand);
  const active = speech.phase !== "idle";
  useEffect(() => {
    stopRef.current = speech.stop;
  }, [speech.stop]);
  useEffect(() => {
    dictation.current = false;
    dictationField.current = null;
    setDictating(false);
  }, [pathname]);
  useEffect(() => {
    if (!active) {
      dictation.current = false;
      setDictating(false);
    }
  }, [active]);

  useEffect(() => {
    if (!active) {
      targets.current = [];
      setBadges([]);
      return;
    }
    let frame = 0;
    const update = () => {
      targets.current = getVoiceTargets();
      setBadges(
        targets.current.flatMap((target, index) => {
          const rect = target.element.getBoundingClientRect();
          if (
            rect.bottom <= 0 ||
            rect.top >= window.innerHeight ||
            rect.right <= 0 ||
            rect.left >= window.innerWidth
          )
            return [];
          return [
            {
              number: index + 1,
              x: Math.max(1, Math.min(rect.left, window.innerWidth - 30)),
              y: Math.max(1, rect.top - 8),
            },
          ];
        }),
      );
    };
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(update);
    };
    const observer = new MutationObserver((records) => {
      if (
        records.some(
          (r) =>
            !(r.target instanceof Element ? r.target : r.target.parentElement)?.closest(
              "[data-voice-ui]",
            ),
        )
      )
        schedule();
    });
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: [
        "disabled",
        "aria-disabled",
        "aria-label",
        "aria-hidden",
        "aria-expanded",
        "hidden",
        "inert",
      ],
    });
    const resize = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(schedule);
    resize?.observe(document.body);
    document.addEventListener("scroll", schedule, true);
    window.addEventListener("resize", schedule);
    update();
    return () => {
      observer.disconnect();
      resize?.disconnect();
      cancelAnimationFrame(frame);
      document.removeEventListener("scroll", schedule, true);
      window.removeEventListener("resize", schedule);
    };
  }, [active]);

  return (
    <VoiceContext.Provider
      value={{
        active,
        dictating,
        supported,
        transcript: speech.interim || heard,
        startExpense: () => {
          window.speechSynthesis?.cancel();
          if (dictating) {
            dictation.current = false;
            setDictating(false);
            setMessage("Ab commands bolo, jaise “parse karo”.");
            return;
          }
          const field = document.querySelector<HTMLTextAreaElement>(
            'textarea[aria-label="Expense text"]',
          );
          if (!field) return;
          field.focus();
          dictationField.current = field;
          dictation.current = true;
          setDictating(true);
          setHeard("");
          setMessage("Kharcha bolo. Phir “likhna band”, “parse karo” bolo.");
          if (!active) speech.start(language);
        },
        stop: () => speech.stop(),
      }}
    >
      <section
        data-voice-ui
        className="voice-toolbar sticky top-[69px] z-40 mx-4 mt-4 rounded-2xl border border-border bg-card/95 px-4 py-3 backdrop-blur md:mx-8"
        aria-label="Voice controls"
      >
        <div className="flex items-center gap-2">
          {supported && (
            <Button
              variant={active ? "destructive" : "outline"}
              className="min-h-11 shrink-0 rounded-xl"
              aria-pressed={active}
              onClick={() => {
                dictation.current = false;
                setDictating(false);
                if (active) {
                  speech.stop();
                  setMessage("Mic band hai.");
                } else {
                  window.speechSynthesis?.cancel();
                  setHeard("");
                  setMessage("Mic permission allow karo, phir command bolo.");
                  speech.start(language);
                }
              }}
            >
              {active ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              {active ? "Stop voice" : "Start voice"}
            </Button>
          )}
          <Select value={language} onValueChange={setLanguage} disabled={active || !supported}>
            <SelectTrigger className="h-11 min-w-0 flex-1 rounded-xl" aria-label="Voice language">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="en-IN">English / Hinglish</SelectItem>
              <SelectItem value="hi-IN">हिन्दी</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="ghost"
            size="icon"
            className="h-11 w-11 shrink-0"
            aria-label="Voice help"
            aria-expanded={help}
            onClick={() => setHelp((open) => !open)}
          >
            <CircleHelp className="h-5 w-5" />
          </Button>
        </div>
        <p role="status" aria-live="polite" className="mt-1 text-xs text-muted-foreground">
          {!supported
            ? "Voice recognition available nahi hai. Wispr Flow ya text box se kharcha likho."
            : speech.error ||
              (speech.phase === "starting"
                ? "Mic connect ho raha hai…"
                : active
                  ? `${dictating ? "Dictation on" : "Listening"} · ${message}`
                  : message)}
        </p>
        {active && (speech.interim || heard) && (
          <p
            className="mt-2 truncate rounded-full bg-secondary px-3 py-2 text-xs"
            aria-label="Last heard"
            aria-live="polite"
          >
            Suna: {speech.interim || heard}
          </p>
        )}
        <Sheet open={help} onOpenChange={setHelp}>
          <SheetContent
            side="bottom"
            className="mx-auto max-h-[85dvh] max-w-xl overflow-y-auto rounded-t-3xl text-sm"
          >
            <SheetHeader>
              <SheetTitle>Website ko bolkar chalao</SheetTitle>
              <SheetDescription>
                Start voice dabao, phir in commands se website chalao. Keyboard aur Fn key apne
                normal kaam karte hain.
              </SheetDescription>
            </SheetHeader>
            <ul className="list-inside list-disc space-y-1">
              <li>
                “add kholo”, “balances kholo”, “settle kholo”, “history kholo”, “report kholo”,
                “members kholo”, “review kholo”
              </li>
              <li>
                “wrapped dikhao”, “settle up kholo”, “reminder bhejo”, “haan theek hai”. Ek se zyada
                reminders hon toh button ka number bolo.
              </li>
              <li>
                Numbered control ke liye “click 5”; field par “click 5”, phir “likho 500”. Dropdown
                kholo, phir option ka number bolo.
              </li>
              <li>
                Kharcha: “add kholo” → “likhna shuru” → apna kharcha bolo → “likhna band” → “parse
                karo” → review → “save karo”.
              </li>
              <li>“search chai”, “neeche jao”, “upar jao”, “confirm”, “cancel”, “mic band”.</li>
              <li>“wapas jao”, “discard karo”, “scroll neeche”, “scroll upar”.</li>
              <li>
                Reminder: “tone savage”, “tone polite”, “tone filmy”, “tone mummy”, “whatsapp pe
                bhejo”.
              </li>
              <li>Settle: “pay karo”, “QR dikhao”. Wrapped: “share karo”, “next”, “previous”.</li>
              <li>
                “Kaun pay kare”, “hisaab sunao”, “restore review”. Briefing sunte waqt mic band
                rahega; phir Start voice dabao.
              </li>
            </ul>
            <p className="text-xs text-muted-foreground">
              Start par browser mic permission maangega. Browser speech service audio process kar
              sakti hai; internet zaroori ho sakta hai. Tab hide hone par mic band hota hai. Wispr
              Flow/type karna bhi chalega. UPI ka final payment apni UPI app mein confirm karo.
            </p>
          </SheetContent>
        </Sheet>
      </section>
      {children}
      {active && (
        <div data-voice-ui aria-hidden="true" className="pointer-events-none fixed inset-0 z-[80]">
          {badges.map((badge) => (
            <span
              key={badge.number}
              className="absolute rounded-md border border-primary-foreground bg-primary px-1.5 py-0.5 text-[11px] font-bold leading-4 text-primary-foreground shadow-sm"
              style={{ left: badge.x, top: badge.y }}
            >
              {badge.number}
            </span>
          ))}
        </div>
      )}
    </VoiceContext.Provider>
  );
}
