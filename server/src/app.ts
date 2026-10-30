import express, { type ErrorRequestHandler } from "express";
import cors from "cors";
import { rateLimit } from "express-rate-limit";
import type { PrismaClient } from "@prisma/client";
import { createGroupsRouter, removeGroupMember } from "./groups.js";
import { updateOwnProfile } from "./auth.js";
import { createAuth } from "./auth.js";
import { HttpError } from "./errors.js";
import { createService, memberDto } from "./service.js";
import { parseExpenses, indiaToday, type Completion } from "./parser.js";
import { generateReminder } from "./reminder.js";
import { createWrappedCache } from "./wrapped.js";
import {
  z,
  ZodError,
  balancesSchema,
  expensePatch,
  expenseSchema,
  filtersSchema,
  groupSchema,
  memberInput,
  memberPatch,
  memberSchema,
  monthSchema,
  parseInput,
  parsedResponseSchema,
  reportSchema,
  saveInput,
  settlementsSchema,
  reminderInput,
  reminderSchema,
  wrappedSchema,
} from "./schemas.js";

export function createApp(
  db: PrismaClient,
  options: {
    complete?: Completion;
    groupCode?: string;
    parseLimit?: number;
    reminderLimit?: number;
    joinLimit?: number;
  } = {},
) {
  const app = express();
  const auth = createAuth(db);
  const scoped = (res: express.Response) => res.locals.service as ReturnType<typeof createService>;
  const wrapped = createWrappedCache();
  app.disable("x-powered-by");
  if (process.env.TRUST_PROXY_HOPS) app.set("trust proxy", Number(process.env.TRUST_PROXY_HOPS));
  const origins = (process.env.CORS_ORIGIN || "http://127.0.0.1:8080,http://localhost:8080")
    .split(",")
    .map((s) => s.trim());
  app.use(
    cors({
      credentials: true,
      origin(origin, callback) {
        callback(null, !origin || origins.includes(origin));
      },
    }),
  );
  app.use(express.json({ limit: "128kb" }));
  app.use("/api", (req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    if (
      !["GET", "HEAD", "OPTIONS"].includes(req.method) &&
      (!req.headers.origin || !origins.includes(req.headers.origin))
    ) {
      res.status(403).json({ error: "Request origin not allowed" });
      return;
    }
    next();
  });
  app.use("/api/auth", auth.router);
  app.use("/api", async (req, res, next) => {
    const session = await auth.session(req);
    if (!session) throw new HttpError(401, "Please sign in.");
    res.locals.session = session;
    next();
  });
  app.use("/api/groups", createGroupsRouter(db, options.joinLimit));
  app.use("/api", async (_req, res, next) => {
    const session = res.locals.session;
    const member = session.activeGroupId
      ? await db.member.findFirst({
          where: { groupId: session.activeGroupId, userId: session.userId, status: "active" },
          include: { group: true },
        })
      : null;
    if (!member || (member.group.expiresAt && member.group.expiresAt <= new Date()))
      throw new HttpError(403, "Group access unavailable.");
    res.locals.service = createService(db, member.group.code);
    res.locals.membership = member;
    next();
  });
  const send = <T>(res: express.Response, schema: z.ZodType<T>, value: unknown, status = 200) => {
    const result = schema.safeParse(value);
    if (!result.success)
      throw new HttpError(500, "The server returned invalid data. Please try again.");
    res.status(status).json(result.data);
  };
  app.get("/health", async (_req, res) => {
    await db.$queryRaw`SELECT 1`;
    res.json({ status: "ok" });
  });
  app.get("/api/group", async (_req, res) =>
    send(res, groupSchema, {
      ...(await scoped(res).getGroup()),
      myMemberId: res.locals.membership.id,
      myRole: res.locals.membership.role,
      requireApproval: res.locals.membership.group.requireApproval,
    }),
  );
  app.post(
    "/api/parse",
    rateLimit({
      windowMs: 60000,
      limit: options.parseLimit ?? 10,
      standardHeaders: "draft-8",
      legacyHeaders: false,
      message: { error: "Too many parsing requests. Please wait a minute." },
    }),
    async (req, res) => {
      const input = parseInput.parse(req.body);
      const g = await scoped(res).group();
      send(
        res,
        parsedResponseSchema,
        await parseExpenses(
          { ...input, speaker: input.speaker ?? res.locals.membership.name },
          g.members.filter((m) => m.status === "active").map(memberDto),
          options.complete,
        ),
      );
    },
  );
  app.post("/api/expenses", async (req, res) => {
    const body = saveInput.parse(req.body);
    send(res, z.array(expenseSchema), await scoped(res).save(body.expenses, body.rawText), 201);
  });
  app.post(
    "/api/reminder",
    rateLimit({
      windowMs: 60000,
      limit: options.reminderLimit ?? 10,
      standardHeaders: "draft-8",
      legacyHeaders: false,
      message: { error: "Too many reminder requests. Please wait a minute." },
    }),
    async (req, res) => {
      const input = reminderInput.parse(req.body);
      const group = await scoped(res).group();
      send(res, reminderSchema, await generateReminder(input, group.members.map(memberDto)));
    },
  );
  app.get("/api/expenses", async (req, res) =>
    send(res, z.array(expenseSchema), await scoped(res).list(filtersSchema.parse(req.query))),
  );
  app.patch("/api/expenses/:id", async (req, res) =>
    send(
      res,
      expenseSchema,
      await scoped(res).updateExpense(req.params.id as string, expensePatch.parse(req.body)),
    ),
  );
  app.delete("/api/expenses/:id", async (req, res) => {
    await scoped(res).deleteExpense(req.params.id as string);
    res.status(204).end();
  });
  app.get("/api/balances", async (_req, res) =>
    send(res, balancesSchema, await scoped(res).getBalances()),
  );
  app.get("/api/settlements", async (_req, res) =>
    send(res, settlementsSchema, await scoped(res).getSettlements()),
  );
  app.get("/api/report", async (req, res) =>
    send(
      res,
      reportSchema,
      await scoped(res).report(monthSchema.parse(req.query.month ?? indiaToday().slice(0, 7))),
    ),
  );
  app.get(
    "/api/wrapped",
    rateLimit({
      windowMs: 60000,
      limit: 20,
      standardHeaders: "draft-8",
      legacyHeaders: false,
      message: { error: "Too many Wrapped requests. Please wait a minute." },
    }),
    async (req, res) => {
      const month = monthSchema.parse(req.query.month ?? indiaToday().slice(0, 7));
      const group = await scoped(res).getGroup();
      send(
        res,
        wrappedSchema,
        await wrapped(group.id, month, group.members, await scoped(res).list()),
      );
    },
  );
  app.post("/api/members", async (req, _res) => {
    memberInput.parse(req.body);
    throw new HttpError(409, "Use an invite code to add a registered account.");
  });
  app.patch("/api/members/:id", async (req, res) => {
    if (req.params.id !== res.locals.membership.id)
      throw new HttpError(403, "Group access unavailable.");
    const input = memberPatch.parse(req.body);
    if (input.id && input.id !== req.params.id)
      throw new HttpError(400, "Member ID cannot be changed.");
    await updateOwnProfile(db, res.locals.session.userId, { name: input.name, upiId: input.upiId });
    const member = await db.member.findUniqueOrThrow({ where: { id: res.locals.membership.id } });
    send(res, memberSchema, memberDto(member));
  });
  app.delete("/api/members/:id", async (req, res) => {
    await removeGroupMember(
      db,
      res.locals.membership.groupId,
      res.locals.session.userId,
      req.params.id as string,
    );
    res.status(204).end();
  });
  app.use((_req, res) => {
    res.status(404).json({ error: "Endpoint not found" });
  });
  const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
    if (error instanceof HttpError) {
      res.status(error.status).json({ error: error.message });
      return;
    }
    if (error instanceof ZodError) {
      res.status(400).json({
        error: error.issues
          .map((i) => `${i.path.join(".")}: ${i.message}`)
          .join("; ")
          .slice(0, 1500),
      });
      return;
    }
    if (error.type === "entity.parse.failed") {
      res.status(400).json({ error: "Request body must be valid JSON" });
      return;
    }
    if (error.type === "entity.too.large") {
      res.status(413).json({ error: "This request is too large. Try a shorter chat excerpt." });
      return;
    }
    if (["P2002", "P2003", "P2025", "P2034"].includes(error.code)) {
      res
        .status(409)
        .json({ error: "This change conflicts with existing data. Refresh and try again." });
      return;
    }
    console.error("Backend request failed", error instanceof Error ? error.name : "UnknownError");
    res.status(500).json({
      error: "Couldn't complete the request. Check the database connection and try again.",
    });
  };
  app.use(errorHandler);
  return app;
}
