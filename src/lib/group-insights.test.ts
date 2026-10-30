import { expect, it } from "vitest";
import { nextPayers, groupBriefing } from "./group-insights";
const group = {
  id: "g",
  name: "Flat 302",
  members: [
    { id: "a", name: "Aman" },
    { id: "k", name: "Kabir" },
    { id: "r", name: "Riya" },
  ],
};
const balances = [
  { memberId: "a", net: -100.01 },
  { memberId: "k", net: 150.01 },
  { memberId: "r", net: -50 },
];
it("suggests the largest debtor, handles ties and everyone settled, without mutations", () => {
  const before = structuredClone(balances);
  expect(nextPayers(group, balances)).toEqual([{ id: "a", name: "Aman", owedPaise: 10001 }]);
  expect(balances).toEqual(before);
  expect(
    nextPayers(group, [
      { memberId: "a", net: -1 },
      { memberId: "k", net: 2 },
      { memberId: "r", net: -1 },
    ]).map((m) => m.name),
  ).toEqual(["Aman", "Riya"]);
  expect(
    nextPayers(
      group,
      balances.map((b) => ({ ...b, net: 0 })),
    ),
  ).toEqual([]);
});
it("refuses incomplete, fractional-paise or out-of-sync data", () => {
  expect(() => nextPayers(group, balances.slice(1))).toThrow();
  expect(() =>
    nextPayers(group, [
      { memberId: "a", net: -0.001 },
      { memberId: "k", net: 0.001 },
      { memberId: "r", net: 0 },
    ]),
  ).toThrow();
  expect(() => groupBriefing(group, balances, [])).toThrow(/changed/);
});
it("explains net signs and valid settlements with exact rupees and a non-payment disclaimer", () => {
  const text = groupBriefing(group, balances, [
    { fromId: "a", toId: "k", amount: 100.01 },
    { fromId: "r", toId: "k", amount: 50 },
  ]);
  expect(text).toContain("Aman owes 100.01 rupees");
  expect(text).toContain("Kabir gets back 150.01 rupees");
  expect(text).toContain("Aman pays Kabir");
  expect(text).toContain("payment record nahi");
  expect(
    groupBriefing(
      group,
      balances.map((b) => ({ ...b, net: 0 })),
      [],
    ),
  ).toContain("Sab barabar");
});
