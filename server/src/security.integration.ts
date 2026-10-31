import { afterAll, beforeAll, expect, it, vi } from "vitest";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { randomUUID } from "node:crypto";
import { createApp } from "./app.js";
import { createDb } from "./db.js";
const db = createDb();
let server: Server,
  base = "",
  groupId = "";
const users: { id: string; cookie: string }[] = [];
const origin = "http://127.0.0.1:8080";
async function call(
  who: number,
  path: string,
  method = "GET",
  body?: unknown,
  requestOrigin = origin,
) {
  return fetch(base + path, {
    method,
    headers: {
      Origin: requestOrigin,
      Cookie: users[who]?.cookie ?? "",
      "Content-Type": "application/json",
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}
beforeAll(async () => {
  vi.stubEnv("USE_CLAUDE_STUB", "true");
  vi.stubEnv("NODE_ENV", "production");
  server = createApp(db, { parseLimit: 1, reminderLimit: 1 }).listen(0, "127.0.0.1");
  await new Promise<void>((r) => server.on("listening", r));
  base = "http://127.0.0.1:" + (server.address() as AddressInfo).port;
  for (const name of ["SecurityAlpha", "SecurityBeta"]) {
    const r = await call(-1, "/api/auth/signup", "POST", {
      name,
      email: name + randomUUID() + "@test.invalid",
      password: "security-check-123",
    });
    expect(r.status).toBe(200);
    const cookie = r.headers.get("set-cookie")!;
    expect(cookie).toContain("__Host-khata_session=");
    expect(cookie).toContain("Secure");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Lax");
    users.push({ id: (await r.json()).user.id, cookie: cookie.split(";")[0]! });
  }
  const created = await (await call(0, "/api/groups", "POST", { name: "Security checks" })).json();
  groupId = created.groupId;
  await call(1, "/api/groups/join", "POST", { code: created.invite.code });
  const pending = await db.member.findFirstOrThrow({ where: { groupId, userId: users[1]!.id } });
  await call(0, "/api/groups/" + groupId + "/members/" + pending.id + "/approve", "POST", {});
});
afterAll(async () => {
  if (server) await new Promise<void>((r) => server.close(() => r()));
  if (groupId) {
    await db.payment.deleteMany({ where: { groupId } });
    await db.expense.deleteMany({ where: { groupId } });
    await db.member.deleteMany({ where: { groupId } });
    await db.group.delete({ where: { id: groupId } });
  }
  await db.user.deleteMany({ where: { id: { in: users.map((u) => u.id) } } });
  await db.$disconnect();
  vi.unstubAllEnvs();
});
it("sets security headers and rejects CSRF, large bodies and invalid requests without traces", async () => {
  const health = await call(-1, "/health");
  expect(health.status).toBe(200);
  expect(health.headers.get("x-content-type-options")).toBe("nosniff");
  expect(health.headers.get("x-frame-options")).toBe("SAMEORIGIN");
  expect(health.headers.get("strict-transport-security")).toContain("max-age");
  expect(health.headers.has("x-powered-by")).toBe(false);
  const bad = await call(
    0,
    "/api/auth/profile",
    "PATCH",
    { name: "Changed" },
    "https://evil.invalid",
  );
  expect(bad.status).toBe(403);
  expect(bad.headers.has("access-control-allow-origin")).toBe(false);
  const missing = await fetch(base + "/api/auth/logout", {
    method: "POST",
    headers: { Cookie: users[0]!.cookie },
  });
  expect(missing.status).toBe(403);
  const huge = await call(0, "/api/auth/profile", "PATCH", { name: "x".repeat(140000) });
  expect(huge.status).toBe(413);
  expect(await huge.json()).toEqual({ error: expect.any(String) });
  const invalid = await call(0, "/api/auth/profile", "PATCH", { upiId: "not-a-vpa" });
  expect(invalid.status).toBe(400);
  expect(Object.keys(await invalid.json())).toEqual(["error"]);
});
it("limits every model endpoint per account rather than blocking other users on the same IP", async () => {
  for (const who of [0, 1])
    expect(
      (await call(who, "/api/parse", "POST", { text: "hello", mode: "brain-dump" })).status,
    ).toBe(200);
  expect((await call(0, "/api/parse", "POST", { text: "hello", mode: "brain-dump" })).status).toBe(
    429,
  );
  const members = await db.member.findMany({ where: { groupId } });
  const input = { fromId: members[0]!.id, toId: members[1]!.id, amount: 1, tone: "polite" };
  for (const who of [0, 1])
    expect((await call(who, "/api/reminder", "POST", input)).status).toBe(200);
  expect((await call(0, "/api/reminder", "POST", input)).status).toBe(429);
  for (let n = 0; n < 20; n++)
    expect((await call(0, "/api/wrapped?month=2026-10")).status).toBe(200);
  expect((await call(0, "/api/wrapped?month=2026-10")).status).toBe(429);
  expect((await call(1, "/api/wrapped?month=2026-10")).status).toBe(200);
});
