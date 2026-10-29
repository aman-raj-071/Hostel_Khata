import { createContext } from "react";

export const VoiceContext = createContext<{
  active: boolean;
  transcript: string;
  startExpense: () => void;
} | null>(null);
