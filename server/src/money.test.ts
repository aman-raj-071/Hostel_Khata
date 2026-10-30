import { describe, expect, it } from "vitest";
import { balances, equalSplit, simplify, toPaise, toRupees } from "./money.js";

describe("integer money and equal rounding", () => {
  it("converts decimal rupees without floating point accumulation", () => {
    expect(toPaise(0.29)).toBe(29);
    expect(toRupees(10001)).toBe(100.01);
    expect(() => toPaise(1.001)).toThrow();
    expect(() => toPaise(Infinity)).toThrow();
    expect(() => toPaise(-1)).toThrow();
  });
  it("gives all leftover paise to the payer wherever they appear", () => {
    expect(equalSplit(100, ["a", "b", "c"], "b")).toEqual([
      { memberId: "a", sharePaise: 33 },
      { memberId: "b", sharePaise: 34 },
      { memberId: "c", sharePaise: 33 },
    ]);
    expect(equalSplit(2, ["a", "b", "c", "d", "e"], "c").map((s) => s.sharePaise)).toEqual([
      0, 0, 2, 0, 0,
    ]);
  });
  it("rejects impossible or duplicate participants", () => {
    expect(() => equalSplit(100, [], "a")).toThrow();
    expect(() => equalSplit(100, ["a", "a"], "a")).toThrow();
    expect(() => equalSplit(100, ["b", "c", "d"], "a")).toThrow(/payer/);
    expect(equalSplit(100, ["b", "c"], "a").map((s) => s.sharePaise)).toEqual([50, 50]);
  });
});

describe("debt simplification", () => {
  it.each([
    [[1000, 800, -800, -500, -500], 3],
    [[800, 700, 600, -900, -800, -400], 4],
  ])("finds the global minimum on cases where largest-first greedy overpays", (amounts, count) => {
    const ledger = (amounts as number[]).map((netPaise, index) => ({
      memberId: String(index),
      netPaise,
    }));
    const result = simplify(ledger);
    expect(result).toHaveLength(count as number);
    const remaining = new Map(ledger.map((balance) => [balance.memberId, balance.netPaise]));
    for (const payment of result) {
      remaining.set(payment.fromId, remaining.get(payment.fromId)! + payment.amountPaise);
      remaining.set(payment.toId, remaining.get(payment.toId)! - payment.amountPaise);
    }
    expect([...remaining.values()].every((value) => value === 0)).toBe(true);
  });
  it("keeps large-group requests bounded and rejects duplicate IDs", () => {
    const large = [...Array(8).fill(1000), ...Array(10).fill(-800)].map((netPaise, index) => ({
      memberId: String(index),
      netPaise,
    }));
    expect(simplify(large).length).toBeLessThanOrEqual(17);
    expect(() =>
      simplify([
        { memberId: "a", netPaise: 100 },
        { memberId: "a", netPaise: -100 },
      ]),
    ).toThrow("unique");
  });
  it.each([
    ["three members", [-5000, -3000, 8000]],
    ["five members", [-5000, -3000, -2000, 4000, 6000]],
    ["paise rounding", [-1, -99, 34, 66]],
    ["everyone settled", [0, 0, 0, 0]],
    ["single creditor", [-100, -200, -300, -400, 1000]],
    ["reselects largest remaining debt", [-800, -700, 1000, 500]],
  ])("clears %s exactly without mutating inputs", (_name, amounts) => {
    const input = (amounts as number[]).map((netPaise, i) => ({ memberId: String(i), netPaise }));
    const copy = structuredClone(input);
    const payments = simplify(input);
    expect(input).toEqual(copy);
    const remaining = new Map(input.map((b) => [b.memberId, b.netPaise]));
    for (const s of payments) {
      expect(s.amountPaise).toBeGreaterThan(0);
      remaining.set(s.fromId, remaining.get(s.fromId)! + s.amountPaise);
      remaining.set(s.toId, remaining.get(s.toId)! - s.amountPaise);
    }
    expect([...remaining.values()].every((n) => n === 0)).toBe(true);
    expect(payments.length).toBeLessThanOrEqual(input.length - 1);
  });
  it("cancels circular debt", () => {
    const expenses = [
      ["a", "b"],
      ["b", "c"],
      ["c", "a"],
    ].map(([payerId, memberId]) => ({
      payerId: payerId!,
      amountPaise: 100,
      shares: [{ memberId: memberId!, sharePaise: 100 }],
    }));
    expect(simplify(balances(["a", "b", "c"], expenses))).toEqual([]);
  });
  it("includes repayments in balances", () => {
    const initial = {
      payerId: "a",
      amountPaise: 101,
      shares: [{ memberId: "b", sharePaise: 101 }],
    };
    const repayment = {
      payerId: "b",
      amountPaise: 101,
      shares: [{ memberId: "a", sharePaise: 101 }],
    };
    expect(simplify(balances(["a", "b"], [initial, repayment]))).toEqual([]);
  });
  it("rejects invalid ledgers", () => {
    expect(() => simplify([{ memberId: "a", netPaise: 1 }])).toThrow();
  });
});
