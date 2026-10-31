import { afterEach, describe, expect, it, vi } from "vitest";
import {
  addMember,
  deleteExpense,
  getBalances,
  getGroup,
  listExpenses,
  parseText,
  saveExpenses,
  generateReminder,
} from "@/lib/api";
import { setDraft } from "@/lib/draft";
import type { ParsedExpense } from "@/lib/types";

afterEach(() => vi.unstubAllGlobals());
describe("HTTP data boundary", () => {
  it("posts reminder data and validates the response", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({ message: "Aman, ₹340 Riya ko bhej do. UPI available hai." }),
      )
      .mockResolvedValueOnce(Response.json({ message: "" }));
    vi.stubGlobal("fetch", fetcher);
    const input = { fromId: "a", toId: "r", amount: 340, tone: "polite" as const };
    expect((await generateReminder(input)).message).toContain("₹340");
    expect(fetcher.mock.calls[0]![0]).toContain("/api/reminder");
    expect(JSON.parse(fetcher.mock.calls[0]![1].body)).toEqual(input);
    await expect(generateReminder(input)).rejects.toThrow("unexpected data");
  });
  it("preserves signatures and sends filters and JSON bodies", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(Response.json([]))
      .mockResolvedValueOnce(Response.json({ id: "m1", name: "Dev" }));
    vi.stubGlobal("fetch", fetcher);
    expect(await listExpenses({ memberId: "m 1", q: "chai & maggi", month: "2026-10" })).toEqual(
      [],
    );
    expect(fetcher.mock.calls[0]![1].credentials).toBe("include");
    const url = new URL(fetcher.mock.calls[0]![0], "http://127.0.0.1:8080");
    expect(url.searchParams.get("q")).toBe("chai & maggi");
    expect(await addMember("Dev")).toEqual({ id: "m1", name: "Dev" });
    expect(JSON.parse(fetcher.mock.calls[1]![1].body)).toEqual({ name: "Dev" });
  });
  it("keeps original source text through parse and confirmed save", async () => {
    const fetcher = vi.fn().mockResolvedValue(Response.json({ expenses: [] }));
    vi.stubGlobal("fetch", fetcher);
    await parseText("chai 100", "brain-dump");
    const draft: ParsedExpense[] = [
      {
        payer: "Kabir",
        amount: 100,
        description: "Chai",
        category: "food",
        date: "2026-10-29",
        splitType: "equal",
        participants: ["Kabir"],
        shares: [{ member: "Kabir", amount: 100 }],
        confidence: 1,
        needsClarification: false,
        question: null,
      },
    ];
    setDraft(draft, "chai 100");
    fetcher.mockResolvedValueOnce(Response.json([]));
    await saveExpenses(draft);
    expect(JSON.parse(fetcher.mock.calls[1]![1].body)).toEqual({
      expenses: draft,
      rawText: "chai 100",
    });
    fetcher.mockResolvedValueOnce(Response.json([]));
    await saveExpenses([]);
    expect(JSON.parse(fetcher.mock.calls[2]![1].body)).toEqual({ expenses: [] });
    setDraft([]);
  });
  it("handles 204 without attempting JSON", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 204 })));
    await expect(deleteExpense("expense/1")).resolves.toBeUndefined();
  });
  it("shows backend, network and response validation errors", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ error: "Database unavailable" }, { status: 503 }))
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce(Response.json({ members: null }));
    vi.stubGlobal("fetch", fetcher);
    await expect(getBalances()).rejects.toThrow("Database unavailable");
    await expect(getGroup()).rejects.toThrow("Couldn't reach");
    await expect(getGroup()).rejects.toThrow("unexpected data");
  });
});
