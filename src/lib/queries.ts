import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as api from "./api";

export const useGroup = () => useQuery({ queryKey: ["group"], queryFn: api.getGroup });
export const useBalances = () => useQuery({ queryKey: ["balances"], queryFn: api.getBalances });
export const useSettlements = () =>
  useQuery({ queryKey: ["settlements"], queryFn: api.getSettlements });
export const useExpenses = (f: Parameters<typeof api.listExpenses>[0] & object) =>
  useQuery({ queryKey: ["expenses", f], queryFn: () => api.listExpenses(f) });
export const useReport = (month: string) =>
  useQuery({ queryKey: ["report", month], queryFn: () => api.getReport(month) });

/** Call after any write so every screen refetches. */
export function useRefreshAll() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries();
}
