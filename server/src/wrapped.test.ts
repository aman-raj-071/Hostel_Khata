import { afterEach, describe, expect, it, vi } from "vitest";
import { createWrappedCache, wrappedCaptions, wrappedFacts } from "./wrapped.js";
import type { Expense } from "../../src/lib/types.js";

const members = [
  { id: "a", name: "Aman" },
  { id: "r", name: "Riya" },
  { id: "d", name: "Dev" },
];
function expense(
  id: string,
  date: string,
  payerId: string,
  amount: number,
  shares: [string, number][],
  description = "Dinner",
): Expense {
  return {
    id,
    date,
    payerId,
    amount,
    description,
    category: "food",
    shares: shares.map(([memberId, amount]) => ({ memberId, amount })),
  };
}
const ledger = [
  expense("old", "2026-09-15", "a", 300, [["r", 300]]),
  expense(
    "tea",
    "2026-10-01",
    "a",
    90.01,
    [
      ["a", 30.01],
      ["r", 30],
      ["d", 30],
    ],
    "Chai",
  ),
  expense("dinner", "2026-10-02", "d", 120, [
    ["a", 40],
    ["r", 40],
    ["d", 40],
  ]),
];
afterEach(() => {
  vi.unstubAllEnvs();
});
describe("Wrapped computed facts", () => {
  it("computes monthly awards in paise, with old net dues aged as of the month", () => {
    const result = wrappedFacts(members, ledger, "2026-10", "2026-10-29");
    expect(result.total).toBe(210.01);
    expect(result.biggestExpense?.id).toBe("dinner");
    expect(result.awards.map((award) => [award.title, award.memberId, award.value])).toEqual([
      ["Daanveer", "d", 120],
      ["Udhaar King", "r", 70],
      ["Chai ka Raja", "a", 1],
      ["Sabse late payer", "r", 44],
      ["Kanjoos", "r", 0],
    ]);
  });
  it("includes repayments in net debt but not total spend, tea counts or biggest expense", () => {
    const result = wrappedFacts(
      members,
      [...ledger, expense("repay", "2026-10-03", "r", 370, [["a", 370]], "Settlement")],
      "2026-10",
      "2026-10-29",
    );
    expect(result.total).toBe(210.01);
    expect(result.biggestExpense?.id).toBe("dinner");
    expect(result.awards.find((award) => award.title === "Sabse late payer")?.memberId).toBe("a");
  });
  it("does not invent tea winners or old debts, and makes ties independent of input ordering", () => {
    const flat = [expense("single", "2026-10-01", "a", 100, [["a", 100]])];
    const result = wrappedFacts(members, flat, "2026-10", "2026-10-29");
    expect(result.awards.find((award) => award.title === "Chai ka Raja")?.memberId).toBeNull();
    expect(result.awards.find((award) => award.title === "Udhaar King")?.memberId).toBeNull();
    expect(result.awards.find((award) => award.title === "Sabse late payer")?.memberId).toBeNull();
    expect(wrappedFacts([...members].reverse(), flat, "2026-10", "2026-10-29")).toEqual(result);
    expect(wrappedFacts(members, ledger, "2026-08")).toEqual({
      total: 0,
      awards: [],
      biggestExpense: null,
    });
  });
  it("uses description rather than a bulk chat rawText to count chai", () => {
    const result = wrappedFacts(
      members,
      [{ ...ledger[2]!, rawText: "Chai 100 and dinner 120" }],
      "2026-10",
    );
    expect(result.awards.find((award) => award.title === "Chai ka Raja")?.value).toBe(0);
  });
});

describe("Wrapped cache and stub", () => {
  it("coalesces concurrent opens, invalidates changed facts and scopes group/month", async () => {
    const complete = vi.fn(async (facts: ReturnType<typeof wrappedFacts>) =>
      facts.awards.map((award) => award.line),
    );
    const cached = createWrappedCache(complete);
    await Promise.all([
      cached("g", "2026-10", members, ledger),
      cached("g", "2026-10", members, ledger),
    ]);
    expect(complete).toHaveBeenCalledTimes(1);
    await cached("other", "2026-10", members, ledger);
    expect(complete).toHaveBeenCalledTimes(2);
    await cached("g", "2026-10", members, [
      ...ledger,
      expense("new", "2026-10-04", "r", 60, [["r", 60]], "Coffee"),
    ]);
    expect(complete).toHaveBeenCalledTimes(3);
  });
  it("does not cache failures or call the captioner for empty months", async () => {
    const complete = vi
      .fn()
      .mockRejectedValueOnce(new Error("unavailable"))
      .mockImplementation(async (facts) =>
        facts.awards.map((award: { line: string }) => award.line),
      );
    const cached = createWrappedCache(complete);
    await expect(cached("g", "2026-10", members, ledger)).rejects.toThrow("unavailable");
    await cached("g", "2026-10", members, ledger);
    await cached("g", "2026-08", members, ledger);
    expect(complete).toHaveBeenCalledTimes(2);
  });
  it("returns deterministic captions in stub mode and clear missing-key errors otherwise", async () => {
    const facts = wrappedFacts(members, ledger, "2026-10");
    vi.stubEnv("USE_CLAUDE_STUB", "true");
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    expect(await wrappedCaptions(facts, members)).toEqual(facts.awards.map((award) => award.line));
    vi.stubEnv("USE_CLAUDE_STUB", "false");
    await expect(wrappedCaptions(facts, members)).rejects.toThrow(
      "ANTHROPIC_API_KEY not configured",
    );
  });
});
