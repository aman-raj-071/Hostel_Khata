import { createContext } from "react";

export const VoiceContext = createContext<{
  active: boolean;
  dictating: boolean;
  supported: boolean;
  transcript: string;
  stop: () => void;
  startExpense: () => void;
} | null>(null);
