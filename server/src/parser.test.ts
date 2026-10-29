import { afterEach, describe, expect, it, vi } from "vitest";
import { claudeCompletion, matchMember, normalizeParsed, parseExpenses } from "./parser.js";
import type { ParsedExpense } from "../../src/lib/types.js";

const members = ["Kabir", "Aman", "Riya", "Dev", "Sneha"].map((name) => ({ id: name, name }));
const example: ParsedExpense = {
  payer: "Kabir",
  amount: 100,
  description: "Dinner",
  category: "food",
  date: "2026-10-29",
  splitType: "equal",
  participants: ["Kabir", "Aman", "Riya"],
  shares: [],
  confidence: 0.9,
  needsClarification: false,
  question: null,
};
afterEach(() => vi.unstubAllEnvs());
describe("shared parser pipeline", () => {
  it("matches typos and honorific nicknames, refusing ambiguous names", () => {
    expect(matchMember("Amn", members)?.name).toBe("Aman");
    expect(matchMember("AMAN bhai", members)?.name).toBe("Aman");
    expect(matchMember("riyaa", members)?.name).toBe("Riya");
    expect(matchMember("Unknown", members)).toBeUndefined();
    expect(
      matchMember("aman", [
        { id: "1", name: "Aman" },
        { id: "2", name: "Aman bhai" },
      ]),
    ).toBeUndefined();
  });
  it("retains unknown expenses with clarification, and computes equal paise", () => {
    const parsed = normalizeParsed({ ...example, payer: "Stranger" }, members);
    expect(parsed.needsClarification).toBe(true);
    expect(parsed.question).toContain("Stranger");
    const good = normalizeParsed(example, members);
    expect(good.shares.map((s) => s.amount)).toEqual([33.34, 33.33, 33.33]);
  });
  it("keeps an unknown amount visible for correction", () => {
    expect(normalizeParsed({ ...example, amount: 0 }, members).needsClarification).toBe(true);
  });
  it("retries invalid JSON once with validation feedback", async () => {
    const complete = vi
      .fn()
      .mockResolvedValueOnce("not JSON")
      .mockResolvedValueOnce(JSON.stringify({ expenses: [example] }));
    const result = await parseExpenses(
      { text: "dinner 100", mode: "brain-dump" },
      members,
      complete,
    );
    expect(result.expenses).toHaveLength(1);
    expect(complete).toHaveBeenCalledTimes(2);
    expect(complete.mock.calls[1]![1]).toBeTruthy();
    expect(complete.mock.calls[0]![0].members).toEqual(members.map((m) => m.name));
  });
  it.each(["exact", "percent", "itemized"] as const)(
    "rejects mismatched %s shares after one retry",
    async (splitType) => {
      const complete = vi.fn().mockResolvedValue(
        JSON.stringify({
          expenses: [{ ...example, splitType, shares: [{ member: "Kabir", amount: 99 }] }],
        }),
      );
      await expect(
        parseExpenses({ text: "expense", mode: "brain-dump" }, members, complete),
      ).rejects.toMatchObject({ status: 422 });
      expect(complete).toHaveBeenCalledTimes(2);
    },
  );
  it("retries invalid dates, duplicate matched names, and invalid categories", async () => {
    for (const patch of [
      { date: "2026-02-30" },
      { participants: ["Aman", "Amn"] },
      { category: "invalid" },
    ]) {
      const complete = vi
        .fn()
        .mockResolvedValue(JSON.stringify({ expenses: [{ ...example, ...patch }] }));
      await expect(
        parseExpenses({ text: "expense", mode: "brain-dump" }, members, complete),
      ).rejects.toMatchObject({ status: 422 });
    }
  });
  it("stub bypasses Anthropic without a key and uses the same pipeline", async () => {
    vi.stubEnv("USE_CLAUDE_STUB", "true");
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    const result = await parseExpenses(
      { text: "Riya ne maggi 120 li, Aman nahi tha, baaki sab barabar", mode: "brain-dump" },
      members,
    );
    expect(result.expenses[0]?.payer).toBe("Riya");
    expect(result.expenses[0]?.participants).not.toContain("Aman");
    expect(result.expenses[0]?.shares.reduce((sum, s) => sum + s.amount, 0)).toBe(120);
  });
  it("treats member-name regex characters literally in the stub", async () => {
    vi.stubEnv("USE_CLAUDE_STUB", "true");
    const result = await parseExpenses(
      { text: "Kabir ne dinner 100 sab barabar, Aman+ nahi tha", mode: "brain-dump" },
      [
        { id: "k", name: "Kabir" },
        { id: "a", name: "Aman+" },
      ],
    );
    expect(result.expenses[0]?.participants).toEqual(["Kabir"]);
  });
  it("stub off without a key gives the required error", async () => {
    vi.stubEnv("USE_CLAUDE_STUB", "false");
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    await expect(
      claudeCompletion({
        text: "hello",
        members: [],
        speaker: null,
        today: "2026-10-29",
        mode: "brain-dump",
      }),
    ).rejects.toMatchObject({ status: 503, message: "ANTHROPIC_API_KEY not configured" });
  });
});
