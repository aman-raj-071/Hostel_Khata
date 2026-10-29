import { expect, it } from "vitest";
import { splitEqually } from "@/components/SplitChips";
import { inr } from "@/lib/format";

it("previews payer remainder in integer paise and displays it", () => {
  expect(splitEqually(1, ["a", "b", "c"], "b").map((s) => s.amount)).toEqual([0.33, 0.34, 0.33]);
  expect(splitEqually(0.02, ["a", "b", "c"], "a").map((s) => s.amount)).toEqual([0.02, 0, 0]);
  expect(inr(0.01)).toBe("₹0.01");
});
