import { afterEach, expect, it, vi } from "vitest";
import { parseExpenses } from "./parser.js";
const members = ["Kabir", "Aman", "Riya", "Dev", "Sneha"].map((name) => ({ id: name, name }));
afterEach(() => vi.unstubAllEnvs());
async function parse(text: string, mode: "brain-dump" | "chat-import" = "brain-dump") {
  vi.stubEnv("USE_CLAUDE_STUB", "true");
  vi.stubEnv("ANTHROPIC_API_KEY", "");
  return (await parseExpenses({ text, mode, speaker: "Kabir" }, members)).expenses;
}
it("keeps every paragraph expense", async () => {
  const result = await parse(
    "Kabir ne dinner 600 sab barabar, Aman ne wifi 799 sab barabar; Riya ne auto 150 sab barabar",
  );
  expect(result.map((e) => e.amount)).toEqual([600, 799, 150]);
});
it("keeps conjunction and sentence expenses while preserving itemized clauses", async () => {
  expect(
    (
      await parse(
        "Kabir ne dinner 600 sab barabar aur Aman ne wifi 799 sab barabar. Riya ne auto 150 sab barabar",
      )
    ).map((e) => e.amount),
  ).toEqual([600, 799, 150]);
  expect(
    (await parse("Kabir ne paneer 300 sirf Kabir aur Aman ke liye aur dal 200 sab barabar"))[0]
      ?.splitType,
  ).toBe("itemized");
  expect((await parse("Kabir 100 ya 200 dinner sab barabar"))[0]).toMatchObject({
    amount: 0,
    needsClarification: true,
  });
});
it("strips WhatsApp timestamps, follows sender and allocation continuation, ignores noise", async () => {
  const result = await parse(
    "28/10/26, 9:12 pm - Aman: kal wifi bill 799 maine bhar diya\n28/10/26, 9:13 pm - Dev: lol 123 ok\n28/10/26, 9:14 pm - Aman: sab 5 log barabar",
    "chat-import",
  );
  expect(result).toHaveLength(1);
  expect(result[0]).toMatchObject({
    payer: "Aman",
    amount: 799,
    date: "2026-10-27",
    needsClarification: false,
  });
});
it.each([
  ["sau", 100],
  ["dedh sau", 150],
  ["dhai sau", 250],
  ["paanch sau", 500],
  ["1.5k", 1500],
] as const)("understands %s", async (word, amount) => {
  expect((await parse("Kabir ne chai " + word + " sab barabar"))[0]?.amount).toBe(amount);
});
it("resolves subset typos and exclusions without dropping unknown names", async () => {
  expect((await parse("Kabir ne dinner 600, Amn aur Riyaa ke saath"))[0]?.participants).toEqual([
    "Kabir",
    "Aman",
    "Riya",
  ]);
  expect(
    (await parse("Riya ne maggi 120, Amn nahi tha baaki sab barabar"))[0]?.participants,
  ).not.toContain("Aman");
  expect(
    (await parse("Kabir ne dinner 200, Aman aur Stranger ke saath"))[0]?.needsClarification,
  ).toBe(true);
  expect((await parse("Kabir ne dinner 200 sab except Stranger"))[0]?.needsClarification).toBe(
    true,
  );
});
it("computes exact and percentage allocations in paise", async () => {
  const exact = (await parse("Kabir ne dinner 350, Aman 200, Riya 150"))[0]!;
  expect(exact).toMatchObject({ splitType: "exact", amount: 350, needsClarification: false });
  expect(exact.shares).toEqual([
    { member: "Aman", amount: 200 },
    { member: "Riya", amount: 150 },
  ]);
  const percent = (await parse("Kabir ne dinner 100.01, Kabir 50%, Aman 50%"))[0]!;
  expect(percent.shares).toEqual([
    { member: "Kabir", amount: 50.01 },
    { member: "Aman", amount: 50 },
  ]);
});
it("aggregates priced itemized meals and asks for missing item prices", async () => {
  const result = (
    await parse("Kabir ne paneer 300 sirf Kabir aur Aman ke liye, dal 200 sab barabar")
  )[0]!;
  expect(result.splitType).toBe("itemized");
  expect(result.amount).toBe(500);
  expect(result.shares).toEqual([
    { member: "Kabir", amount: 190 },
    { member: "Aman", amount: 190 },
    { member: "Riya", amount: 40 },
    { member: "Dev", amount: 40 },
    { member: "Sneha", amount: 40 },
  ]);
  const unclear = (
    await parse("Kabir ne dinner 500 paneer sirf Kabir aur Aman ke liye, dal sab barabar")
  )[0]!;
  expect(unclear.needsClarification).toBe(true);
  expect(unclear.shares).toEqual([]);
});
it.each(["100 ya 200", "-100", "around 100", ""])(
  "never guesses ambiguous amount %s",
  async (amount) => {
    expect((await parse("Kabir ne dinner " + amount + " sab barabar"))[0]).toMatchObject({
      amount: 0,
      needsClarification: true,
    });
  },
);
it("distinguishes repayments from unclear outstanding debt", async () => {
  expect((await parse("Dev ne Aman ko 340 bhej diye"))[0]).toMatchObject({
    description: "Settlement",
    payer: "Dev",
    participants: ["Aman"],
    shares: [{ member: "Aman", amount: 340 }],
  });
  expect((await parse("Kabir ka 200 udhaar baaki"))[0]?.needsClarification).toBe(true);
});
