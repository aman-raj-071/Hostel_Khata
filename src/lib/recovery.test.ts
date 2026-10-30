import { beforeEach, expect, it, vi } from "vitest";
import { loadCheckpoint, storeCheckpoint } from "./recovery";
import type { ParsedExpense } from "./types";
const expense: ParsedExpense = {
  payer: "Kabir",
  amount: 100,
  description: "Dinner",
  category: "food",
  date: "2026-10-30",
  splitType: "equal",
  participants: ["Kabir"],
  shares: [{ member: "Kabir", amount: 100 }],
  confidence: 0.9,
  needsClarification: false,
  question: null,
};
beforeEach(() => localStorage.clear());
it("round-trips exact unsaved cards and original text per group", () => {
  expect(storeCheckpoint(localStorage, "a", [expense], "raw Hinglish", 1000)).toBe(true);
  expect(loadCheckpoint(localStorage, "a", 2000)).toMatchObject({
    groupId: "a",
    expenses: [expense],
    source: "raw Hinglish",
  });
  expect(loadCheckpoint(localStorage, "b", 2000)).toBeNull();
});
it("rejects corrupt, oversized, expired, future and cross-group checkpoints", () => {
  for (const raw of [
    "bad",
    "x".repeat(256001),
    JSON.stringify({ version: 1, groupId: "wrong", savedAt: 1000, expenses: [expense] }),
  ]) {
    localStorage.setItem("khata-review-v1:a", raw);
    expect(loadCheckpoint(localStorage, "a", 2000)).toBeNull();
  }
  storeCheckpoint(localStorage, "a", [expense], undefined, 1000);
  expect(loadCheckpoint(localStorage, "a", 1000 + 8 * 86400000)).toBeNull();
  storeCheckpoint(localStorage, "a", [expense], undefined, 3000);
  expect(loadCheckpoint(localStorage, "a", 2000)).toBeNull();
});
it("clears after save/discard and handles disabled or full storage without crashing", () => {
  storeCheckpoint(localStorage, "a", [expense]);
  storeCheckpoint(localStorage, "a", []);
  expect(loadCheckpoint(localStorage, "a")).toBeNull();
  const blocked = {
    getItem: vi.fn(() => {
      throw new Error("blocked");
    }),
    setItem: vi.fn(() => {
      throw new Error("quota");
    }),
    removeItem: vi.fn(),
  } as unknown as Storage;
  expect(storeCheckpoint(blocked, "a", [expense])).toBe(false);
  expect(loadCheckpoint(blocked, "a")).toBeNull();
  expect(storeCheckpoint(localStorage, "a", [{ ...expense, amount: -1 }])).toBe(false);
});
