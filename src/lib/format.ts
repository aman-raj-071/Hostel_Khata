import type { Member } from "./types";

export const inr = (n: number) =>
  `₹${Math.abs(n).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

export const CATEGORIES = ["food", "rent", "utilities", "travel", "groceries", "other"] as const;

export const CATEGORY_EMOJI: Record<string, string> = {
  food: "🍛",
  rent: "🏠",
  utilities: "💡",
  travel: "🛺",
  groceries: "🥛",
  other: "📦",
};

export const CATEGORY_COLOR: Record<string, string> = {
  food: "var(--chart-1)",
  rent: "var(--chart-2)",
  utilities: "var(--chart-3)",
  travel: "var(--chart-4)",
  groceries: "var(--chart-5)",
  other: "var(--muted-foreground)",
};

export const memberName = (members: Member[] | undefined, id: string) =>
  members?.find((m) => m.id === id)?.name ?? "Unknown";

export const prettyDate = (d: string) =>
  new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short" });

export function buildUpiLink(upiId: string, name: string, amount: number) {
  return `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(name)}&am=${amount.toFixed(2)}&cu=INR&tn=Hostel%20Khata`;
}
