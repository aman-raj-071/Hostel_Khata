import express, { type ErrorRequestHandler } from "express";
import cors from "cors";
import { rateLimit } from "express-rate-limit";
import type { PrismaClient } from "@prisma/client";
import { HttpError } from "./errors.js";
import { createService, memberDto } from "./service.js";
import { parseExpenses, indiaToday, type Completion } from "./parser.js";
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
} from "./schemas.js";

export function createApp(
  db: PrismaClient,
  options: { complete?: Completion; groupCode?: string; parseLimit?: number } = {},
) {
  const app = express();
  const service = createService(db, options.groupCode);
  app.disable("x-powered-by");
  if (process.env.TRUST_PROXY_HOPS) app.set("trust proxy", Number(process.env.TRUST_PROXY_HOPS));
  const origins = (process.env.CORS_ORIGIN || "http://127.0.0.1:8080,http://localhost:8080")
    .split(",")
    .map((s) => s.trim());
  app.use(
    cors({
      origin(origin, callback) {
        callback(null, !origin || origins.includes(origin));
      },
    }),
  );
  app.use(express.json({ limit: "128kb" }));
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
  app.get("/api/group", async (_req, res) => send(res, groupSchema, await service.getGroup()));
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
      const g = await service.group();
      send(
        res,
        parsedResponseSchema,
        await parseExpenses(input, g.members.map(memberDto), options.complete),
      );
    },
  );
  app.post("/api/expenses", async (req, res) => {
    const body = saveInput.parse(req.body);
    send(res, z.array(expenseSchema), await service.save(body.expenses, body.rawText), 201);
  });
  app.get("/api/expenses", async (req, res) =>
    send(res, z.array(expenseSchema), await service.list(filtersSchema.parse(req.query))),
  );
  app.patch("/api/expenses/:id", async (req, res) =>
    send(
      res,
      expenseSchema,
      await service.updateExpense(req.params.id as string, expensePatch.parse(req.body)),
    ),
  );
  app.delete("/api/expenses/:id", async (req, res) => {
    await service.deleteExpense(req.params.id as string);
    res.status(204).end();
  });
  app.get("/api/balances", async (_req, res) =>
    send(res, balancesSchema, await service.getBalances()),
  );
  app.get("/api/settlements", async (_req, res) =>
    send(res, settlementsSchema, await service.getSettlements()),
  );
  app.get("/api/report", async (req, res) =>
    send(
      res,
      reportSchema,
      await service.report(monthSchema.parse(req.query.month ?? indiaToday().slice(0, 7))),
    ),
  );
  app.post("/api/members", async (req, res) =>
    send(res, memberSchema, await service.addMember(memberInput.parse(req.body)), 201),
  );
  app.patch("/api/members/:id", async (req, res) =>
    send(
      res,
      memberSchema,
      await service.updateMember(req.params.id as string, memberPatch.parse(req.body)),
    ),
  );
  app.delete("/api/members/:id", async (req, res) => {
    await service.removeMember(req.params.id as string);
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
