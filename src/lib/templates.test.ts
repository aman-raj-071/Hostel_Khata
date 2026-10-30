import { expect, it } from "vitest";
import { recurringPreview } from "./templates";
import type { Expense } from "./types";
const group = {
  id: "g",
  name: "Flat",
  members: [
    { id: "k", name: "Kabir" },
    { id: "a", name: "Aman" },
    { id: "r", name: "Riya" },
  ],
};
const bill: Expense = {
  id: "e",
  payerId: "k",
  amount: 100,
  description: "Wifi bill",
  category: "utilities",
  date: "2026-10-01",
  shares: [],
};
it("reuses latest real amount, today's members/date, and requires confirmation", () => {
  const result = recurringPreview(
    0,
    [{ ...bill, id: "new", amount: 100.01, date: "2026-10-20" }, bill],
    group,
    "2026-10-30",
  );
  expect(result).toMatchObject({
    amount: 100.01,
    date: "2026-10-30",
    needsClarification: true,
    participants: ["Kabir", "Aman", "Riya"],
  });
  expect(result.shares.map((s) => s.amount)).toEqual([33.35, 33.33, 33.33]);
});
it("never invents an amount or payer without a prior bill", () => {
  expect(recurringPreview(2, [], group, "2026-10-30")).toMatchObject({
    amount: 0,
    payer: "",
    shares: [],
    needsClarification: true,
  });
  expect(recurringPreview(0, [{ ...bill, payerId: "removed" }], group, "2026-10-30").payer).toBe(
    "",
  );
});
