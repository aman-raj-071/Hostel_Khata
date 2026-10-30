import { createContext, useContext } from "react";
import type { AccountSession } from "./api";
export const AccountContext = createContext<{
  session: AccountSession | null;
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<unknown>;
}>({ session: null, loading: true, error: null, refresh: async () => {} });
export const useAccount = () => useContext(AccountContext);
export function clearPrivateDrafts() {
  try {
    for (const key of Object.keys(localStorage))
      if (key.startsWith("khata-review-v1:")) localStorage.removeItem(key);
  } catch {
    /* Storage may be disabled. */
  }
}
