import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
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
let ownerId: string;
let cookie = "";
async function call(path: string, method = "GET", body?: unknown) {
  const response = await fetch(base + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      Origin: "http://127.0.0.1:8080",
      Cookie: cookie,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const setCookie = response.headers.get("set-cookie");
  if (setCookie) cookie = setCookie.split(";")[0]!;
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
  server = createApp(db, { parseLimit: 100 }).listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.on("listening", resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const registered = await call("/api/auth/signup", "POST", {
    name: "Kabir",
    email: code + "@test.invalid",
    password: "integration-password",
  });
  expect(registered.status).toBe(200);
  ownerId = registered.data.user.id;
  await db.group.update({ where: { id: groupId }, data: { createdBy: ownerId } });
  await db.member.updateMany({
    where: { groupId, name: "Kabir" },
    data: { userId: ownerId, role: "admin" },
  });
  await db.session.updateMany({ where: { userId: ownerId }, data: { activeGroupId: groupId } });
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
  if (ownerId) await db.user.delete({ where: { id: ownerId } });
  await db.$disconnect();
  vi.unstubAllEnvs();
});

describe("real HTTP + Prisma flow", () => {
  it("generates scoped reminder tones without saving or changing balances", async () => {
    const group = (await call("/api/group")).data;
    const input = {
      fromId: group.members[0].id,
      toId: group.members[1].id,
      amount: 340.51,
      tone: "polite",
    };
    const before = (await call("/api/balances")).data;
    for (const tone of ["polite", "filmy", "mummy", "savage"]) {
      const result = await call("/api/reminder", "POST", { ...input, tone });
      expect(result.status).toBe(200);
      expect(result.data.message).toContain("₹340.51");
      expect(result.data.message).toContain(group.members[0].name);
      expect(result.data.message).toContain(group.members[1].name);
      expect(result.data.message).toContain("UPI");
    }
    expect((await call("/api/balances")).data).toEqual(before);
    expect((await call("/api/expenses")).data).toHaveLength(0);
    expect((await call("/api/reminder", "POST", { ...input, fromId: outsiderId })).status).toBe(
      422,
    );
    expect((await call("/api/reminder", "POST", { ...input, amount: 0 })).status).toBe(400);
    expect((await call("/api/reminder", "POST", { ...input, amount: 1.001 })).status).toBe(400);
    expect((await call("/api/reminder", "POST", { ...input, tone: "abusive" })).status).toBe(400);
    vi.stubEnv("USE_CLAUDE_STUB", "false");
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    expect(await call("/api/reminder", "POST", input)).toEqual({
      status: 503,
      data: { error: "ANTHROPIC_API_KEY not configured" },
    });
    vi.stubEnv("USE_CLAUDE_STUB", "true");
    const limited = createApp(db, { reminderLimit: 1 }).listen(0, "127.0.0.1");
    await new Promise<void>((resolve) => limited.on("listening", resolve));
    try {
      const url = `http://127.0.0.1:${(limited.address() as AddressInfo).port}/api/reminder`;
      const request = {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: "http://127.0.0.1:8080",
          Cookie: cookie,
        },
        body: JSON.stringify(input),
      };
      expect((await fetch(url, request)).status).toBe(200);
      const blocked = await fetch(url, request);
      expect(blocked.status).toBe(429);
      expect((await blocked.json()).error).toContain("wait a minute");
    } finally {
      await new Promise<void>((resolve) => limited.close(() => resolve()));
    }
  });
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
    const s = settlements[0]!;
    const from = g.members.find((m: { id: string }) => m.id === s.fromId)!.name;
    const to = g.members.find((m: { id: string }) => m.id === s.toId)!.name;
    const repayment = await call("/api/parse", "POST", {
      text: from + " ne " + to + " ko " + s.amount + " bhej diye",
      mode: "brain-dump",
    });
    expect(repayment.data.expenses[0].description).toBe("Settlement");
    expect((await call("/api/expenses", "POST", repayment.data)).status).toBe(422);
    expect((await call("/api/settlements")).data).toHaveLength(2);
    const report = (await call(`/api/report?month=${expenses[0].date.slice(0, 7)}`)).data;
    expect(report.total).toBe(100);
    expect(report.summaryText).toContain("Integration group");
    expect(report.byMember).toHaveLength(5);
    for (const e of (await call("/api/expenses")).data)
      expect((await call(`/api/expenses/${e.id}`, "DELETE")).status).toBe(204);
  });
  it("validates CRUD and blocks cross-group writes and unresolved saves atomically", async () => {
    expect((await call("/api/members", "POST", { name: "Guest" })).status).toBe(409);
    const own = (await call("/api/group")).data.members.find(
      (m: { userId?: string }) => m.userId === ownerId,
    );
    expect((await call("/api/members/" + own.id, "PATCH", { upiId: "" })).status).toBe(200);
    expect((await call("/api/members/" + outsiderId, "PATCH", { name: "Hacked" })).status).toBe(
      403,
    );
    expect((await call("/api/members/" + outsiderId, "DELETE")).status).toBe(403);
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
  it("returns computed, cached Wrapped stories without cross-group members", async () => {
    const group = (await call("/api/group")).data;
    const date = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
    const parsed = {
      payer: group.members[0].name,
      amount: 90.01,
      description: "Chai",
      category: "food",
      date,
      splitType: "equal",
      participants: [group.members[0].name, group.members[1].name],
      shares: [],
      confidence: 1,
      needsClarification: false,
      question: null,
    };
    const saved = await call("/api/expenses", "POST", {
      expenses: [parsed, { ...parsed, description: "Gang dinner", amount: 999 }],
    });
    expect(saved.status).toBe(201);
    try {
      const path = `/api/wrapped?month=${date.slice(0, 7)}`;
      const first = await call(path);
      expect(first.status).toBe(200);
      expect(first.data.total).toBe(1089.01);
      expect(first.data.biggestExpense.amount).toBe(999);
      expect(first.data.awards).toHaveLength(5);
      expect(
        first.data.awards.some((award: { memberId: string }) => award.memberId === outsiderId),
      ).toBe(false);
      expect(await call(path)).toEqual(first);
      expect((await call("/api/wrapped?month=2026-99")).status).toBe(400);
      vi.stubEnv("USE_CLAUDE_STUB", "false");
      vi.stubEnv("ANTHROPIC_API_KEY", "");
      expect((await call(path)).status).toBe(503);
    } finally {
      vi.stubEnv("USE_CLAUDE_STUB", "true");
      for (const expense of saved.data) await call(`/api/expenses/${expense.id}`, "DELETE");
    }
  });
  it("checks CORS, consistent JSON errors and parse rate limits", async () => {
    const response = await fetch(base + "/api/group", {
      headers: { Origin: "http://127.0.0.1:8080", Cookie: cookie },
    });
    expect(response.headers.get("access-control-allow-origin")).toBe("http://127.0.0.1:8080");
    expect((await call("/missing")).data).toEqual({ error: "Endpoint not found" });
    const malformed = await fetch(base + "/api/parse", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "http://127.0.0.1:8080",
        Cookie: cookie,
      },
      body: "{",
    });
    expect(malformed.status).toBe(400);
    expect(await malformed.json()).toEqual({ error: "Request body must be valid JSON" });
    const limited = createApp(db, { parseLimit: 1 }).listen(0, "127.0.0.1");
    await new Promise<void>((resolve) => limited.on("listening", resolve));
    const url = `http://127.0.0.1:${(limited.address() as AddressInfo).port}/api/parse`;
    try {
      const req = {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: "http://127.0.0.1:8080",
          Cookie: cookie,
        },
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
  it("seed maintenance never creates a shared public group", async () => {
    const before = await db.group.count();
    const runSeed = () =>
      promisify(execFile)(
        process.execPath,
        [
          fileURLToPath(new URL("../node_modules/tsx/dist/cli.mjs", import.meta.url)),
          "--env-file-if-exists=.env",
          "prisma/seed.ts",
        ],
        { cwd: process.cwd(), env: process.env, timeout: 60000 },
      );
    await runSeed();
    await runSeed();
    expect(await db.group.count()).toBeLessThanOrEqual(before);
    expect(await db.group.findUnique({ where: { id: groupId } })).not.toBeNull();
  }, 130000);
});
