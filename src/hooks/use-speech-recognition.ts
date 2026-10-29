import { useCallback, useEffect, useRef, useState } from "react";

export interface RecognitionResult {
  isFinal: boolean;
  0: { transcript: string };
}
export interface Recognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onstart: (() => void) | null;
  onresult:
    ((event: { resultIndex: number; results: ArrayLike<RecognitionResult> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  abort(): void;
}
export function speechConstructor() {
  const browser = window as Window & {
    SpeechRecognition?: new () => Recognition;
    webkitSpeechRecognition?: new () => Recognition;
  };
  return browser.SpeechRecognition ?? browser.webkitSpeechRecognition;
}

export function useSpeechRecognition(onCommand: (text: string) => void) {
  const [phase, setPhase] = useState<"idle" | "starting" | "listening">("idle");
  const [error, setError] = useState("");
  const [interim, setInterim] = useState("");
  const recognition = useRef<Recognition | null>(null);
  const wanted = useRef(false);
  const restart = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const command = useRef(onCommand);
  useEffect(() => {
    command.current = onCommand;
  }, [onCommand]);

  const stop = useCallback(() => {
    wanted.current = false;
    clearTimeout(restart.current);
    const current = recognition.current;
    recognition.current = null;
    if (current) {
      current.onstart = current.onresult = current.onerror = current.onend = null;
      current.abort();
    }
    setPhase("idle");
    setInterim("");
  }, []);

  const start = useCallback(
    (language: string) => {
      stop();
      setError("");
      const Constructor = speechConstructor();
      if (!Constructor) {
        setError(
          "Is browser mein voice recognition available nahi hai. Supported Chrome/Edge browser ya Wispr Flow use karo.",
        );
        return;
      }
      if (window.isSecureContext === false) {
        setError("Mic ke liye HTTPS ya localhost par website kholo.");
        return;
      }
      const current = new Constructor();
      recognition.current = current;
      wanted.current = true;
      current.lang = language;
      current.continuous = true;
      current.interimResults = true;
      let consumed = 0;
      current.onstart = () => {
        if (recognition.current === current && wanted.current) setPhase("listening");
      };
      current.onresult = (event) => {
        if (!wanted.current || recognition.current !== current) return;
        let preview = "";
        for (let i = Math.max(event.resultIndex, consumed); i < event.results.length; i++) {
          const result = event.results[i];
          if (!result) continue;
          if (result.isFinal) {
            consumed = i + 1;
            command.current(result[0].transcript.trim());
            if (!wanted.current) break;
          } else preview += result[0].transcript;
        }
        setInterim(preview);
      };
      current.onerror = (event) => {
        if (!wanted.current || recognition.current !== current || event.error === "no-speech")
          return;
        stop();
        setError(
          ["not-allowed", "service-not-allowed"].includes(event.error)
            ? "Mic permission nahi mili. Browser settings mein microphone allow karke dobara Start dabao."
            : event.error === "audio-capture"
              ? "Microphone nahi mila. Mic connect karke dobara try karo."
              : event.error === "language-not-supported"
                ? "Yeh language available nahi hai. English / Hinglish mode try karo."
                : "Speech service connect nahi hui. Internet aur browser support check karke dobara Start dabao.",
        );
      };
      current.onend = () => {
        if (!wanted.current || recognition.current !== current) return;
        setPhase("starting");
        restart.current = setTimeout(() => {
          if (!wanted.current || recognition.current !== current) return;
          consumed = 0;
          try {
            current.start();
          } catch {
            stop();
            setError("Mic restart nahi hua. Dobara Start dabao.");
          }
        }, 400);
      };
      setPhase("starting");
      try {
        current.start();
      } catch {
        stop();
        setError("Mic start nahi hua. Browser permission aur microphone check karo.");
      }
    },
    [stop],
  );

  useEffect(() => {
    const hidden = () => {
      if (document.visibilityState === "hidden") stop();
    };
    document.addEventListener("visibilitychange", hidden);
    return () => {
      document.removeEventListener("visibilitychange", hidden);
      wanted.current = false;
      clearTimeout(restart.current);
      const current = recognition.current;
      if (current) {
        current.onstart = current.onresult = current.onerror = current.onend = null;
        current.abort();
      }
    };
  }, [stop]);

  return { phase, error, interim, start, stop };
}
