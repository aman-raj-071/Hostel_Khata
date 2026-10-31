import { expect, test, vi } from "vitest";

vi.mock("@netlify/database", () => ({ getConnectionString: () => "postgresql://test" }));
vi.mock("./db.js", () => ({ createDb: () => ({}) }));

const { handler } = await import("./netlify.js");

test("Netlify forwards API paths and preserves origin validation", async () => {
  const event = {
    httpMethod: "GET",
    path: "/api/auth/me",
    headers: {},
    body: null,
    isBase64Encoded: false,
    requestContext: { identity: { sourceIp: "127.0.0.1" } },
  };
  const session = await handler(event, {});
  expect(session.statusCode).toBe(200);
  expect(JSON.parse(session.body)).toEqual({ user: null, activeGroupId: null });

  const blocked = await handler(
    {
      ...event,
      httpMethod: "POST",
      path: "/api/auth/demo",
      headers: { origin: "https://untrusted.example" },
    },
    {},
  );
  expect(blocked.statusCode).toBe(403);
});
