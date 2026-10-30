import { useSyncExternalStore } from "react";
import type { ParsedExpense } from "./types";

// Holds parsed-but-unsaved expenses between the Add and Review screens.
let draft: ParsedExpense[] = [];
let rawText: string | undefined;
const listeners = new Set<() => void>();

export const getDraft = () => draft;
export function subscribeDraft(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function setDraft(next: ParsedExpense[], source?: string) {
  rawText = next.length ? (source ?? rawText) : undefined;
  draft = next;
  listeners.forEach((l) => l());
}

export function getDraftSource(expenses: ParsedExpense[]) {
  return expenses === draft ? rawText : undefined;
}

export function useDraft() {
  return useSyncExternalStore(
    subscribeDraft,
    () => draft,
    () => draft,
  );
}
