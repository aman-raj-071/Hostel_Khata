import { beforeAll, afterAll, describe, it, expect, vi } from "vitest";
import { randomUUID } from "node:crypto";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { createDb } from "./db.js";
import { createApp } from "./app.js";
const db = createDb();
let server: Server,
  base = "",
  groupId = "",
  otherGroup = "",
  fromId = "",
  toId = "",
  expenseId = "";
const users: { id: string; cookie: string }[] = [];
const suffix = randomUUID();
async function call(who: number, path: string, method = "GET", body?: unknown) {
  const r = await fetch(base + path, {
    method,
    headers: {
      Origin: "http://127.0.0.1:8080",
      "Content-Type": "application/json",
      Cookie: users[who]?.cookie ?? "",
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return {
    status: r.status,
    data: r.status === 204 ? null : await r.json(),
    cookie: r.headers.get("set-cookie")?.split(";")[0] ?? "",
  };
}
beforeAll(async () => {
  vi.stubEnv("USE_CLAUDE_STUB", "true");
  server = createApp(db).listen(0, "127.0.0.1");
  await new Promise<void>((r) => server.on("listening", r));
  base = "http://127.0.0.1:" + (server.address() as AddressInfo).port;
  for (const name of ["ReceiverPay", "PayerPay", "ObserverPay", "OutsidePay"]) {
    const r = await call(-1, "/api/auth/signup", "POST", {
      name,
      email: name + suffix + "@test.invalid",
      password: "payments-test-123",
    });
    expect(r.status).toBe(200);
    users.push({ id: r.data.user.id, cookie: r.cookie });
  }
  const g = await call(0, "/api/groups", "POST", { name: "Payment test" });
  groupId = g.data.groupId;
  for (const who of [1, 2]) {
    await call(who, "/api/groups/join", "POST", { code: g.data.invite.code });
    const m = await db.member.findFirstOrThrow({ where: { groupId, userId: users[who]!.id } });
    expect(
      (await call(0, "/api/groups/" + groupId + "/members/" + m.id + "/approve", "POST", {}))
        .status,
    ).toBe(204);
  }
  const g2 = await call(3, "/api/groups", "POST", { name: "Outside" });
  otherGroup = g2.data.groupId;
  toId = (await db.member.findFirstOrThrow({ where: { groupId, userId: users[0]!.id } })).id;
  fromId = (await db.member.findFirstOrThrow({ where: { groupId, userId: users[1]!.id } })).id;
  const saved = await call(0, "/api/expenses", "POST", {
    expenses: [
      {
        payer: "ReceiverPay",
        amount: 200.02,
        description: "Dinner",
        category: "food",
        date: "2026-10-31",
        splitType: "equal",
        participants: ["ReceiverPay", "PayerPay"],
        shares: [],
        confidence: 1,
        needsClarification: false,
        question: null,
      },
    ],
  });
  expect(saved.status).toBe(201);
  expenseId = saved.data[0].id;
});
afterAll(async () => {
  if (server) await new Promise<void>((r) => server.close(() => r()));
  for (const id of [groupId, otherGroup].filter(Boolean)) {
    await db.payment.deleteMany({ where: { groupId: id } });
    await db.expense.deleteMany({ where: { groupId: id } });
    await db.member.deleteMany({ where: { groupId: id } });
    await db.group.delete({ where: { id } });
  }
  await db.user.deleteMany({ where: { id: { in: users.map((u) => u.id) } } });
  await db.$disconnect();
  vi.unstubAllEnvs();
});
const input = (amount = 100.01) => ({
  fromUserId: users[1]!.id,
  toUserId: users[0]!.id,
  amount,
  upiRef: "UTR-test",
  note: "UPI sent",
});
describe("two-sided payment state machine", () => {
  it("isolates payment records and validates payer, receiver, amount and membership", async () => {
    expect((await call(-1, "/api/payments")).status).toBe(401);
    expect((await call(3, "/api/payments")).data).toEqual([]);
    expect(
      (await call(3, "/api/payments", "POST", { ...input(), fromUserId: users[3]!.id })).status,
    ).toBe(403);
    expect((await call(0, "/api/payments", "POST", input())).status).toBe(403);
    expect((await call(1, "/api/payments/cash", "POST", input())).status).toBe(403);
    for (const amount of [0, -1, 1.001])
      expect((await call(1, "/api/payments", "POST", input(amount))).status).toBe(400);
    expect((await call(1, "/api/payments", "POST", input(100.02))).status).toBe(409);
    expect(
      (await call(1, "/api/payments", "POST", { ...input(), toUserId: users[1]!.id })).status,
    ).toBe(422);
  });
  it("keeps pending claims out of balances, reserves funds and supports cancel/dispute", async () => {
    const before = (await call(0, "/api/balances")).data;
    const p = await call(1, "/api/payments", "POST", input());
    expect(p.status).toBe(201);
    expect(p.data.status).toBe("pending");
    expect((await call(0, "/api/balances")).data).toEqual(before);
    expect((await call(1, "/api/payments", "POST", input())).status).toBe(409);
    for (const who of [1, 2])
      expect((await call(who, "/api/payments/" + p.data.id + "/confirm", "POST", {})).status).toBe(
        403,
      );
    for (const action of ["confirm", "dispute", "cancel"])
      expect((await call(3, "/api/payments/" + p.data.id + "/" + action, "POST", {})).status).toBe(
        404,
      );
    expect((await call(0, "/api/payments/" + p.data.id + "/cancel", "POST", {})).status).toBe(403);
    expect((await call(1, "/api/payments/" + p.data.id + "/cancel", "POST", {})).data.status).toBe(
      "cancelled",
    );
    expect((await call(0, "/api/payments/" + p.data.id + "/confirm", "POST", {})).status).toBe(409);
    const next = (await call(1, "/api/payments", "POST", input())).data;
    expect((await call(0, "/api/payments/" + next.id + "/dispute", "POST", {})).data.status).toBe(
      "disputed",
    );
    expect((await call(0, "/api/balances")).data).toEqual(before);
    expect((await call(1, "/api/payments/" + next.id + "/cancel", "POST", {})).status).toBe(409);
  });
  it("rejects stale claims, confirms once concurrently and protects the settlement ledger", async () => {
    const p = (await call(1, "/api/payments", "POST", input())).data;
    const original = await db.expense.findUniqueOrThrow({
      where: { id: expenseId },
      include: { shares: true },
    });
    await db.expense.update({
      where: { id: expenseId },
      data: {
        amountPaise: 2,
        shares: {
          deleteMany: {},
          create: [
            { memberId: toId, sharePaise: 1 },
            { memberId: fromId, sharePaise: 1 },
          ],
        },
      },
    });
    expect((await call(0, "/api/payments/" + p.id + "/confirm", "POST", {})).status).toBe(409);
    await db.expense.update({
      where: { id: expenseId },
      data: {
        amountPaise: original.amountPaise,
        shares: {
          deleteMany: {},
          create: original.shares.map((s) => ({ memberId: s.memberId, sharePaise: s.sharePaise })),
        },
      },
    });
    const outcomes = await Promise.all([
      call(0, "/api/payments/" + p.id + "/confirm", "POST", {}),
      call(0, "/api/payments/" + p.id + "/confirm", "POST", {}),
    ]);
    expect(outcomes.some((r) => r.status === 200)).toBe(true);
    expect(outcomes.every((r) => [200, 409].includes(r.status))).toBe(true);
    expect((await call(0, "/api/payments/" + p.id + "/confirm", "POST", {})).data.status).toBe(
      "confirmed",
    );
    expect(await db.expense.count({ where: { groupId, description: "Settlement" } })).toBe(1);
    expect((await call(0, "/api/balances")).data.every((b: { net: number }) => b.net === 0)).toBe(
      true,
    );
    const linked = await db.payment.findUniqueOrThrow({ where: { id: p.id } });
    for (const method of ["PATCH", "DELETE"])
      expect(
        (
          await call(
            0,
            "/api/expenses/" + linked.settlementExpenseId,
            method,
            method === "PATCH" ? { amount: 1 } : undefined,
          )
        ).status,
      ).toBe(409);
    expect((await call(1, "/api/payments", "POST", input(0.01))).status).toBe(409);
  });
  it("allows receiver-only cash and prevents direct repayment saves", async () => {
    await db.expense.create({
      data: {
        groupId,
        payerId: toId,
        amountPaise: 201,
        description: "Chai",
        category: "food",
        date: "2026-10-31",
        shares: { create: { memberId: fromId, sharePaise: 201 } },
      },
    });
    const cash = await call(0, "/api/payments/cash", "POST", {
      ...input(2.01),
      upiRef: "",
      note: "Cash received",
    });
    expect(cash.status).toBe(201);
    expect(cash.data.status).toBe("confirmed");
    expect((await call(0, "/api/settlements")).data).toEqual([]);
    expect(
      (await call(0, "/api/expenses/" + expenseId, "PATCH", { description: "Settlement" })).status,
    ).toBe(422);
    expect(
      (
        await call(0, "/api/expenses", "POST", {
          expenses: [
            {
              payer: "PayerPay",
              amount: 1,
              description: "Settlement",
              category: "other",
              date: "2026-10-31",
              splitType: "exact",
              participants: ["ReceiverPay"],
              shares: [{ member: "ReceiverPay", amount: 1 }],
              confidence: 1,
              needsClarification: false,
              question: null,
            },
          ],
        })
      ).status,
    ).toBe(422);
  });
});
