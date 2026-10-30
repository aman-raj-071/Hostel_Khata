import { createContext } from "react";

export const VoiceContext = createContext<{
  active: boolean;
  supported: boolean;
  transcript: string;
  startExpense: () => void;
} | null>(null);
