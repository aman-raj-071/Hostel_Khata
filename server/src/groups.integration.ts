import { beforeAll, afterAll, describe, it, expect, vi } from "vitest";
import { randomUUID } from "node:crypto";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { createDb } from "./db.js";
import { createApp } from "./app.js";
import { claudeCompletion } from "./parser.js";
import type { ParsedExpense } from "../../src/lib/types.js";
const db = createDb();
let server: Server;
let base = "";
const suffix = randomUUID();
const users: { id: string; cookie: string; name: string }[] = [];
const groups: string[] = [];
let aId = "",
  bId = "",
  aCode = "",
  bMemberId = "",
  bExpenseId = "",
  betaMemberId = "";
const seen: string[][] = [];
const origin = "http://127.0.0.1:8080";
async function call(who: number, path: string, method = "GET", body?: unknown, customBase = base) {
  const r = await fetch(customBase + path, {
    method,
    headers: {
      Origin: origin,
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
function expense(payer: string, participants: string[], amount = 100): ParsedExpense {
  return {
    payer,
    participants,
    amount,
    description: "Private lunch",
    category: "food",
    date: "2026-10-30",
    splitType: "equal",
    shares: [],
    confidence: 0.95,
    needsClarification: false,
    question: null,
  };
}
beforeAll(async () => {
  vi.stubEnv("USE_CLAUDE_STUB", "true");
  server = createApp(db, {
    joinLimit: 100,
    parseLimit: 100,
    complete: async (input, error) => {
      seen.push(input.members);
      return claudeCompletion(input, error);
    },
  }).listen(0, "127.0.0.1");
  await new Promise<void>((r) => server.on("listening", r));
  base = "http://127.0.0.1:" + (server.address() as AddressInfo).port;
  for (const name of ["KabirScope", "AmanScope", "RiyaScope", "DevScope"]) {
    const r = await call(-1, "/api/auth/signup", "POST", {
      name,
      email: name.toLowerCase() + suffix + "@test.invalid",
      password: "password-scope-123",
    });
    expect(r.status).toBe(200);
    users.push({ id: r.data.user.id, cookie: r.cookie, name });
  }
  const a = await call(0, "/api/groups", "POST", { name: "Private A" });
  const b = await call(2, "/api/groups", "POST", { name: "Private B" });
  expect(a.status).toBe(201);
  expect(b.status).toBe(201);
  aId = a.data.groupId;
  bId = b.data.groupId;
  aCode = a.data.invite.code;
  groups.push(aId, bId);
  bMemberId = (await call(2, "/api/group")).data.members[0].id;
  const saved = await call(2, "/api/expenses", "POST", {
    expenses: [expense(users[2]!.name, [users[2]!.name])],
  });
  expect(saved.status).toBe(201);
  bExpenseId = saved.data[0].id;
}, 60000);
afterAll(async () => {
  if (server) await new Promise<void>((r) => server.close(() => r()));
  for (const groupId of groups) {
    await db.expense.deleteMany({ where: { groupId } });
    await db.member.deleteMany({ where: { groupId } });
    await db.group.deleteMany({ where: { id: groupId } });
  }
  await db.authAttempt.deleteMany({ where: { key: { in: users.map((u) => "join:" + u.id) } } });
  await db.user.deleteMany({ where: { id: { in: users.map((u) => u.id) } } });
  await db.$disconnect();
  vi.unstubAllEnvs();
});
describe("private group authorization", () => {
  it("blocks outsiders from every group administration endpoint without revealing existence", async () => {
    const matrix: [string, string, unknown?][] = [
      ["GET", "/members"],
      ["GET", "/invites"],
      ["POST", "/invites", {}],
      ["PATCH", "/settings", { requireApproval: false }],
      ["POST", "/select", {}],
      ["POST", "/transfer-admin", { memberId: bMemberId }],
      ["POST", "/leave", {}],
      ["DELETE", "/members/" + bMemberId],
      ["POST", "/members/" + bMemberId + "/approve", {}],
      ["POST", "/members/" + bMemberId + "/reject", {}],
      ["DELETE", "/invites/not-an-invite"],
      ["DELETE", ""],
    ];
    for (const [method, path, body] of matrix) {
      const denied = await call(0, "/api/groups/" + bId + path, method, body);
      expect(denied.status).toBe(403);
      expect(denied.data).toEqual({ error: "Group access unavailable." });
    }
    expect((await call(0, "/api/groups/unknown-group/members")).data).toEqual(
      (await call(0, "/api/groups/" + bId + "/members")).data,
    );
  });
  it("scopes every ledger endpoint, mutation, model context and legacy member facade", async () => {
    expect((await call(0, "/api/group")).data.id).toBe(aId);
    expect((await call(0, "/api/expenses")).data).toEqual([]);
    expect((await call(0, "/api/expenses?memberId=" + bMemberId)).data).toEqual([]);
    expect(
      (await call(0, "/api/expenses/" + bExpenseId, "PATCH", { description: "stolen" })).status,
    ).toBe(404);
    expect((await call(0, "/api/expenses/" + bExpenseId, "DELETE")).status).toBe(404);
    expect(
      (
        await call(0, "/api/expenses", "POST", {
          expenses: [expense(users[2]!.name, [users[2]!.name])],
        })
      ).status,
    ).toBe(422);
    expect((await call(0, "/api/balances")).data).toEqual([
      { memberId: (await call(0, "/api/group")).data.members[0].id, net: 0 },
    ]);
    expect((await call(0, "/api/settlements")).data).toEqual([]);
    expect((await call(0, "/api/report?month=2026-10")).data.total).toBe(0);
    expect((await call(0, "/api/wrapped?month=2026-10")).data.total).toBe(0);
    expect(
      (
        await call(0, "/api/reminder", "POST", {
          fromId: bMemberId,
          toId: (await call(0, "/api/group")).data.members[0].id,
          amount: 10,
          tone: "polite",
        })
      ).status,
    ).toBe(422);
    expect((await call(0, "/api/members/" + bMemberId, "PATCH", { name: "Hacked" })).status).toBe(
      403,
    );
    expect((await call(0, "/api/members/" + bMemberId, "DELETE")).status).toBe(403);
    expect((await call(0, "/api/members", "POST", { name: "Ghost" })).status).toBe(409);
    await call(0, "/api/parse", "POST", {
      text: users[0]!.name + " ne chai 100 sab barabar",
      mode: "brain-dump",
    });
    expect(seen.at(-1)).toEqual([users[0]!.name]);
    expect(await db.expense.findUnique({ where: { id: bExpenseId } })).not.toBeNull();
  });
  it("keeps pending members out, requires approval, blocks unsettled leaving and immediately revokes removed access", async () => {
    const joined = await call(1, "/api/groups/join", "POST", { code: aCode });
    expect(joined.data.status).toBe("pending");
    for (const path of [
      "/api/group",
      "/api/expenses",
      "/api/balances",
      "/api/settlements",
      "/api/report",
      "/api/wrapped",
    ])
      expect((await call(1, path)).status).toBe(403);
    expect((await call(1, "/api/groups/" + aId + "/select", "POST", {})).status).toBe(403);
    expect(
      (await call(1, "/api/parse", "POST", { text: "chai 100", mode: "brain-dump" })).status,
    ).toBe(403);
    betaMemberId = (
      await db.member.findUniqueOrThrow({
        where: { groupId_userId: { groupId: aId, userId: users[1]!.id } },
      })
    ).id;
    expect(
      (await call(0, "/api/groups/" + aId + "/members/" + betaMemberId + "/approve", "POST", {}))
        .status,
    ).toBe(204);
    expect((await call(1, "/api/group")).status).toBe(200);
    expect(
      (await call(1, "/api/groups/" + aId + "/settings", "PATCH", { requireApproval: false }))
        .status,
    ).toBe(403);
    expect((await call(1, "/api/groups/" + aId + "/invites")).status).toBe(403);
    const saved = await call(0, "/api/expenses", "POST", {
      expenses: [expense(users[0]!.name, [users[0]!.name, users[1]!.name], 500)],
    });
    expect(saved.status).toBe(201);
    expect((await call(1, "/api/groups/" + aId + "/leave", "POST", {})).status).toBe(409);
    expect(
      (await call(0, "/api/groups/" + aId + "/members/" + betaMemberId, "DELETE")).status,
    ).toBe(204);
    expect((await call(1, "/api/group")).status).toBe(403);
    expect((await call(1, "/api/report")).status).toBe(403);
    const before = await db.member.findUniqueOrThrow({ where: { id: betaMemberId } });
    await call(1, "/api/auth/profile", "PATCH", { name: "Aman Outside", upiId: "outside@ybl" });
    expect(await db.member.findUnique({ where: { id: betaMemberId } })).toMatchObject({
      name: before.name,
      upiId: before.upiId,
      status: "removed",
    });
    expect(
      (await call(0, "/api/expenses")).data[0].shares.some(
        (s: { memberId: string }) => s.memberId === betaMemberId,
      ),
    ).toBe(true);
    await call(0, "/api/parse", "POST", {
      text: "KabirScope ne chai 100 sab barabar",
      mode: "brain-dump",
    });
    expect(seen.at(-1)).toEqual([users[0]!.name]);
    expect(
      (
        await call(0, "/api/expenses", "POST", {
          expenses: [expense(users[0]!.name, [users[1]!.name])],
        })
      ).status,
    ).toBe(422);
  });
  it("preserves old balances while a removed member requests approval again", async () => {
    expect((await call(1, "/api/groups/join", "POST", { code: aCode })).data.status).toBe(
      "pending",
    );
    expect((await call(1, "/api/group")).status).toBe(403);
    const balance = await call(0, "/api/balances");
    expect(balance.status).toBe(200);
    expect(balance.data).toContainEqual({ memberId: betaMemberId, net: -250 });
    const group = await call(0, "/api/group");
    expect(group.data.members.find((m: { id: string }) => m.id === betaMemberId).status).toBe(
      "pending",
    );
    expect((await call(0, "/api/report?month=2026-10")).data.total).toBe(500);
    await call(0, "/api/parse", "POST", {
      text: "KabirScope ne chai 100 sab barabar",
      mode: "brain-dump",
    });
    expect(seen.at(-1)).toEqual([users[0]!.name]);
  });
  it("supports instant joins only when approval is off, admin transfer, settled leave and confirmed group deletion", async () => {
    const created = await call(0, "/api/groups", "POST", { name: "Transfer group" });
    const id = created.data.groupId;
    groups.push(id);
    expect(
      (await call(0, "/api/groups/" + id + "/settings", "PATCH", { requireApproval: false }))
        .status,
    ).toBe(204);
    expect(
      (await call(1, "/api/groups/join", "POST", { code: created.data.invite.code })).data.status,
    ).toBe("active");
    const member = (
      await db.member.findUniqueOrThrow({
        where: { groupId_userId: { groupId: id, userId: users[1]!.id } },
      })
    ).id;
    expect(
      (await call(0, "/api/groups/" + id + "/transfer-admin", "POST", { memberId: member })).status,
    ).toBe(204);
    expect(
      (await call(0, "/api/groups/" + id + "/settings", "PATCH", { requireApproval: true })).status,
    ).toBe(403);
    expect((await call(0, "/api/groups/" + id + "/leave", "POST", {})).status).toBe(204);
    expect((await call(1, "/api/groups/" + id + "/leave", "POST", {})).status).toBe(409);
    expect((await call(1, "/api/groups/" + id, "DELETE")).status).toBe(204);
  });
  it("rejects revoked, expired and exhausted codes, and never spends a use twice for the same pending request", async () => {
    const created = await call(0, "/api/groups", "POST", { name: "Invite tests" });
    const id = created.data.groupId;
    groups.push(id);
    await call(0, "/api/groups/" + id + "/invites/" + created.data.invite.id, "DELETE");
    expect(
      (await call(2, "/api/groups/join", "POST", { code: created.data.invite.code })).status,
    ).toBe(403);
    const expired = await call(0, "/api/groups/" + id + "/invites", "POST", {});
    await db.groupInvite.update({
      where: { id: expired.data.id },
      data: { expiresAt: new Date(0) },
    });
    expect((await call(2, "/api/groups/join", "POST", { code: expired.data.code })).status).toBe(
      403,
    );
    const limited = await call(0, "/api/groups/" + id + "/invites", "POST", { maxUses: 1 });
    expect(
      (await call(2, "/api/groups/join", "POST", { code: limited.data.code })).data.status,
    ).toBe("pending");
    expect(
      (await call(2, "/api/groups/join", "POST", { code: limited.data.code })).data.status,
    ).toBe("pending");
    expect((await db.groupInvite.findUniqueOrThrow({ where: { id: limited.data.id } })).uses).toBe(
      1,
    );
    expect((await call(1, "/api/groups/join", "POST", { code: limited.data.code })).status).toBe(
      403,
    );
  });
  it("locks guessed codes and enforces request limits", async () => {
    for (let i = 0; i < 5; i++)
      expect((await call(3, "/api/groups/join", "POST", { code: "ZZZZZZZZZZ" })).status).toBe(403);
    expect((await call(3, "/api/groups/join", "POST", { code: aCode })).status).toBe(429);
    const limited = createApp(db, { joinLimit: 2 }).listen(0, "127.0.0.1");
    await new Promise<void>((r) => limited.on("listening", r));
    try {
      const url = "http://127.0.0.1:" + (limited.address() as AddressInfo).port;
      for (let i = 0; i < 2; i++)
        await call(2, "/api/groups/join", "POST", { code: "YYYYYYYYYY" }, url);
      expect((await call(2, "/api/groups/join", "POST", { code: "YYYYYYYYYY" }, url)).status).toBe(
        429,
      );
    } finally {
      await new Promise<void>((r) => limited.close(() => r()));
    }
  });
});
