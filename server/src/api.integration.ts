import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { createDb } from "./db.js";
import { createApp } from "./app.js";
import { createService } from "./service.js";
import type { ParsedExpense, Settlement } from "../../src/lib/types.js";

const db = createDb();
const code = `test-${randomUUID()}`;
const service = createService(db, code);
let server: Server;
let base: string;
let groupId: string;
let outsiderId: string;
let outsiderGroup: string;
async function call(path: string, method = "GET", body?: unknown) {
  const response = await fetch(base + path, {
    method,
    headers: { "Content-Type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return {
    status: response.status,
    data: response.status === 204 ? undefined : await response.json(),
  };
}
beforeAll(async () => {
  vi.stubEnv("USE_CLAUDE_STUB", "true");
  const g = await db.group.create({
    data: {
      code,
      name: "Integration group",
      members: { create: ["Kabir", "Aman", "Riya", "Dev", "Sneha"].map((name) => ({ name })) },
    },
  });
  groupId = g.id;
  const other = await db.group.create({
    data: { code: `other-${code}`, name: "Other", members: { create: { name: "Outsider" } } },
    include: { members: true },
  });
  outsiderGroup = other.id;
  outsiderId = other.members[0]!.id;
  server = createApp(db, { groupCode: code, parseLimit: 100 }).listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.on("listening", resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(async () => {
  if (server)
    await new Promise<void>((resolve, reject) => server.close((e) => (e ? reject(e) : resolve())));
  if (groupId) {
    await db.expense.deleteMany({ where: { groupId } });
    await db.member.deleteMany({ where: { groupId } });
    await db.group.delete({ where: { id: groupId } });
  }
  if (outsiderGroup) {
    await db.member.deleteMany({ where: { groupId: outsiderGroup } });
    await db.group.delete({ where: { id: outsiderGroup } });
  }
  await db.$disconnect();
  vi.unstubAllEnvs();
});

describe("real HTTP + Prisma flow", () => {
  it("parse → confirm → save → edit → balances → record settlement → report", async () => {
    expect((await call("/health")).status).toBe(200);
    const g = (await call("/api/group")).data;
    expect(g.members).toHaveLength(5);
    expect(g.members.some((m: { id: string }) => m.id === outsiderId)).toBe(false);
    const text = "Kabir ne dinner 100 kiya, Aman aur Riya ke saath";
    const parsed = await call("/api/parse", "POST", { text, mode: "brain-dump" });
    expect(parsed.status).toBe(200);
    expect((await call("/api/expenses")).data).toHaveLength(0);
    const expenses = parsed.data.expenses.map((e: ParsedExpense) => ({
      ...e,
      needsClarification: false,
      question: null,
    }));
    const saved = await call("/api/expenses", "POST", { expenses, rawText: text });
    expect(saved.status).toBe(201);
    expect(saved.data[0].rawText).toBe(text);
    expect(
      saved.data[0].shares.reduce(
        (sum: number, s: { amount: number }) => sum + Math.round(s.amount * 100),
        0,
      ),
    ).toBe(10000);
    expect(
      (await call(`/api/expenses/${saved.data[0].id}`, "PATCH", { description: "Dinner edited" }))
        .status,
    ).toBe(200);
    expect(
      (await call(`/api/expenses?q=edited&memberId=${saved.data[0].payerId}`)).data,
    ).toHaveLength(1);
    const settlements: Settlement[] = (await call("/api/settlements")).data;
    expect(settlements).toHaveLength(2);
    for (const s of settlements) {
      const from = g.members.find((m: { id: string }) => m.id === s.fromId)!.name;
      const to = g.members.find((m: { id: string }) => m.id === s.toId)!.name;
      const repayment = await call("/api/parse", "POST", {
        text: `${from} ne ${to} ko ${s.amount} bhej diye`,
        mode: "brain-dump",
      });
      expect(repayment.data.expenses[0].description).toBe("Settlement");
      expect((await call("/api/expenses", "POST", repayment.data)).status).toBe(201);
    }
    expect((await call("/api/balances")).data.every((b: { net: number }) => b.net === 0)).toBe(
      true,
    );
    expect((await call("/api/settlements")).data).toEqual([]);
    const report = (await call(`/api/report?month=${expenses[0].date.slice(0, 7)}`)).data;
    expect(report.total).toBe(166.66);
    expect(report.summaryText).toContain("Integration group");
    expect(report.byMember).toHaveLength(5);
    for (const e of (await call("/api/expenses")).data)
      expect((await call(`/api/expenses/${e.id}`, "DELETE")).status).toBe(204);
  });
  it("validates CRUD and blocks cross-group writes and unresolved saves atomically", async () => {
    const added = await call("/api/members", "POST", { name: "Guest", upiId: "guest@ybl" });
    expect(added.status).toBe(201);
    expect(
      (await call(`/api/members/${added.data.id}`, "PATCH", { upiId: "" })).data.upiId,
    ).toBeUndefined();
    expect((await call(`/api/members/${outsiderId}`, "PATCH", { name: "Hacked" })).status).toBe(
      404,
    );
    expect((await call(`/api/members/${outsiderId}`, "DELETE")).status).toBe(404);
    expect((await call(`/api/members/${added.data.id}`, "DELETE")).status).toBe(204);
    expect((await call("/api/members", "POST", { name: "aman" })).status).toBe(409);
    const p = (
      await call("/api/parse", "POST", {
        text: "Kabir ne dinner 100 sabne barabar",
        mode: "brain-dump",
      })
    ).data.expenses[0];
    expect(
      (await call("/api/expenses", "POST", { expenses: [p, { ...p, payer: "Outsider" }] })).status,
    ).toBe(422);
    expect((await call("/api/expenses")).data).toHaveLength(0);
    expect(
      (
        await call("/api/expenses", "POST", {
          expenses: [{ ...p, needsClarification: true, question: "Who?" }],
        })
      ).status,
    ).toBe(422);
    const created = (await call("/api/expenses", "POST", { expenses: [p] })).data[0];
    expect(
      (await call(`/api/expenses/${created.id}`, "PATCH", { payerId: outsiderId })).status,
    ).toBe(422);
    expect((await call(`/api/members/${created.payerId}`, "DELETE")).status).toBe(409);
    expect(
      (
        await call(`/api/expenses/${created.id}`, "PATCH", {
          shares: [{ memberId: created.payerId, amount: 99 }],
        })
      ).status,
    ).toBe(422);
    await call(`/api/expenses/${created.id}`, "DELETE");
    expect((await call("/api/report?month=2026-13")).status).toBe(400);
    expect((await call("/api/parse", "POST", { text: "", mode: "brain-dump" })).status).toBe(400);
    vi.stubEnv("USE_CLAUDE_STUB", "false");
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    expect(await call("/api/parse", "POST", { text: "Dinner 100", mode: "brain-dump" })).toEqual({
      status: 503,
      data: { error: "ANTHROPIC_API_KEY not configured" },
    });
    vi.stubEnv("USE_CLAUDE_STUB", "true");
  });
  it("checks CORS, consistent JSON errors and parse rate limits", async () => {
    const response = await fetch(base + "/api/group", {
      headers: { Origin: "http://127.0.0.1:8080" },
    });
    expect(response.headers.get("access-control-allow-origin")).toBe("http://127.0.0.1:8080");
    expect((await call("/missing")).data).toEqual({ error: "Endpoint not found" });
    const malformed = await fetch(base + "/api/parse", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{",
    });
    expect(malformed.status).toBe(400);
    expect(await malformed.json()).toEqual({ error: "Request body must be valid JSON" });
    const limited = createApp(db, { groupCode: code, parseLimit: 1 }).listen(0, "127.0.0.1");
    await new Promise<void>((resolve) => limited.on("listening", resolve));
    const url = `http://127.0.0.1:${(limited.address() as AddressInfo).port}/api/parse`;
    try {
      const req = {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: "hi", mode: "brain-dump" }),
      };
      await fetch(url, req);
      const blocked = await fetch(url, req);
      expect(blocked.status).toBe(429);
      expect((await blocked.json()).error).toContain("wait a minute");
    } finally {
      await new Promise<void>((resolve) => limited.close(() => resolve()));
    }
    expect((await service.getGroup()).id).toBe(groupId);
  });
});
