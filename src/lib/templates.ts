import type { Expense, Group, ParsedExpense } from "./types";
import { splitEqually } from "@/components/SplitChips";

export const RECURRING = [
  { name: "WiFi", pattern: /wifi|wi-fi/i, category: "utilities" },
  { name: "Doodh", pattern: /doodh|milk/i, category: "groceries" },
  { name: "Gas", pattern: /\bgas\b|cylinder|lpg/i, category: "utilities" },
] as const;

export function recurringPreview(
  index: number,
  expenses: Expense[],
  group: Group,
  date: string,
): ParsedExpense {
  const template = RECURRING[index];
  if (!template) throw new Error("Unknown recurring template");
  const latest = expenses
    .filter((e) => template.pattern.test(e.description) && e.description !== "Settlement")
    .sort((a, b) => b.date.localeCompare(a.date))[0];
  const payer = group.members.find((m) => m.id === latest?.payerId)?.name ?? "";
  const amount = latest?.amount ?? 0;
  const participants = group.members.map((m) => m.name);
  return {
    payer,
    amount,
    description: template.name,
    category: template.category,
    date,
    splitType: "equal",
    participants,
    shares:
      payer && amount
        ? splitEqually(amount, participants, payer).map((s) => ({
            member: s.key,
            amount: s.amount,
          }))
        : [],
    confidence: 0.4,
    needsClarification: true,
    question: "Pichhla amount liya hai. Aaj ka payer, amount aur split confirm karo.",
  };
}
