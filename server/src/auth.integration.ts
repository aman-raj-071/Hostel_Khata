import { beforeAll, afterAll, describe, it, expect, vi } from "vitest";
import { randomUUID, createHash } from "node:crypto";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import bcrypt from "bcryptjs";
import { createDb } from "./db.js";
import { createApp } from "./app.js";
import { cleanupExpiredDemos } from "./demo.js";
const db = createDb();
let server: Server;
let base = "";
const ids: string[] = [];
const groups: string[] = [];
const suffix = randomUUID();
const origin = "http://127.0.0.1:8080";
async function call(path: string, method = "GET", body?: unknown, cookie = "") {
  const response = await fetch(base + path, {
    method,
    headers: { Origin: origin, "Content-Type": "application/json", Cookie: cookie },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return {
    status: response.status,
    data: response.status === 204 ? null : await response.json(),
    cookie: response.headers.get("set-cookie")?.split(";")[0] ?? "",
    header: response.headers.get("set-cookie") ?? "",
  };
}
beforeAll(async () => {
  vi.stubEnv("USE_CLAUDE_STUB", "true");
  server = createApp(db).listen(0, "127.0.0.1");
  await new Promise<void>((r) => server.on("listening", r));
  base = "http://127.0.0.1:" + (server.address() as AddressInfo).port;
});
afterAll(async () => {
  if (server) await new Promise<void>((r) => server.close(() => r()));
  for (const groupId of groups) {
    await db.expense.deleteMany({ where: { groupId } });
    await db.member.deleteMany({ where: { groupId } });
    await db.group.deleteMany({ where: { id: groupId } });
  }
  await db.user.deleteMany({ where: { id: { in: ids } } });
  await db.authAttempt.deleteMany({
    where: {
      key: createHash("sha256")
        .update("lock-" + suffix + "@test.invalid")
        .digest("hex"),
    },
  });
  await db.$disconnect();
  vi.unstubAllEnvs();
});
describe("accounts and isolated sessions", () => {
  it("validates signup, hashes password, hides sensitive fields and revokes logout", async () => {
    expect(
      (await call("/api/auth/signup", "POST", { name: "", email: "bad", password: "123" })).status,
    ).toBe(400);
    const email = "account-" + suffix + "@test.invalid";
    const created = await call("/api/auth/signup", "POST", {
      name: "Test Person",
      email: email.toUpperCase(),
      password: "strong-password",
    });
    expect(created.status).toBe(200);
    ids.push(created.data.user.id);
    expect(created.data.user.email).toBe(email);
    expect(created.data.user).not.toHaveProperty("passwordHash");
    expect(created.header).toContain("HttpOnly");
    expect(created.header).toContain("SameSite=Lax");
    const stored = await db.user.findUniqueOrThrow({ where: { id: created.data.user.id } });
    expect(await bcrypt.compare("strong-password", stored.passwordHash!)).toBe(true);
    const token = created.cookie.split("=")[1]!;
    expect(await db.session.findUnique({ where: { tokenHash: token } })).toBeNull();
    expect((await call("/api/auth/me", "GET", undefined, created.cookie)).data.user.id).toBe(
      stored.id,
    );
    expect(
      (
        await call(
          "/api/auth/profile",
          "PATCH",
          { name: "Updated", upiId: "not an upi" },
          created.cookie,
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await call(
          "/api/auth/profile",
          "PATCH",
          { name: "Updated", upiId: "updated@ybl" },
          created.cookie,
        )
      ).data.upiId,
    ).toBe("updated@ybl");
    expect((await call("/api/auth/logout", "POST", {}, created.cookie)).status).toBe(204);
    expect((await call("/api/auth/me", "GET", undefined, created.cookie)).data.user).toBeNull();
    const signedIn = await call("/api/auth/login", "POST", { email, password: "strong-password" });
    expect(signedIn.status).toBe(200);
    expect(signedIn.cookie).not.toBe(created.cookie);
  });
  it("uses generic login failures and locks repeated failures including nonexistent emails", async () => {
    const email = "lock-" + suffix + "@test.invalid";
    const created = await call("/api/auth/signup", "POST", {
      name: "Lock Test",
      email,
      password: "strong-password",
    });
    ids.push(created.data.user.id);
    const wrong = await call("/api/auth/login", "POST", { email, password: "wrong-password" });
    const missing = await call("/api/auth/login", "POST", {
      email: "missing-" + suffix + "@test.invalid",
      password: "wrong-password",
    });
    expect(wrong.data).toEqual(missing.data);
    expect(wrong.status).toBe(missing.status);
    for (let i = 0; i < 4; i++)
      await call("/api/auth/login", "POST", { email, password: "wrong-password" });
    expect(
      (await call("/api/auth/login", "POST", { email, password: "strong-password" })).status,
    ).toBe(429);
  });
  it("protects all app endpoints from anonymous requests and rejects missing/untrusted origins", async () => {
    for (const path of [
      "/api/group",
      "/api/expenses",
      "/api/balances",
      "/api/settlements",
      "/api/report",
      "/api/wrapped",
    ])
      expect((await call(path)).status).toBe(401);
    const response = await fetch(base + "/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "No Origin",
        email: "x@test.invalid",
        password: "password-123",
      }),
    });
    expect(response.status).toBe(403);
  });
  it("creates independent private demos, rejects outsider selection and expires them", async () => {
    const a = await call("/api/auth/demo", "POST", {});
    const b = await call("/api/auth/demo", "POST", {});
    expect(a.status).toBe(200);
    expect(b.status).toBe(200);
    expect(a.data.activeGroupId).not.toBe(b.data.activeGroupId);
    groups.push(a.data.activeGroupId, b.data.activeGroupId);
    const demoMembers = await db.member.findMany({ where: { groupId: { in: groups } } });
    ids.push(...demoMembers.map((m) => m.userId!));
    expect((await call("/api/expenses", "GET", undefined, a.cookie)).data).toHaveLength(25);
    const ga = await call("/api/group", "GET", undefined, a.cookie);
    const gb = await call("/api/group", "GET", undefined, b.cookie);
    expect(ga.data.members).toHaveLength(5);
    expect(ga.data.members[0].id).not.toBe(gb.data.members[0].id);
    const forged = await fetch(base + "/api/expenses", {
      headers: { Cookie: a.cookie, "X-Group-Id": b.data.activeGroupId },
    });
    const forgedRows = await forged.json();
    expect(
      forgedRows.every((e: { payerId: string }) =>
        ga.data.members.some((m: { id: string }) => m.id === e.payerId),
      ),
    ).toBe(true);
    await db.user.updateMany({
      where: {
        id: {
          in: demoMembers.filter((m) => m.groupId === a.data.activeGroupId).map((m) => m.userId!),
        },
      },
      data: { demoExpiresAt: new Date(0) },
    });
    await db.group.update({
      where: { id: a.data.activeGroupId },
      data: { expiresAt: new Date(0) },
    });
    expect((await call("/api/group", "GET", undefined, a.cookie)).status).toBe(401);
    await cleanupExpiredDemos(db);
    expect(await db.group.findUnique({ where: { id: a.data.activeGroupId } })).toBeNull();
    expect((await call("/api/group", "GET", undefined, b.cookie)).status).toBe(200);
  });
});
