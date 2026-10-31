import { randomBytes, createHash } from "node:crypto";
import { Router, type Request, type Response } from "express";
import { rateLimit } from "express-rate-limit";
import type { PrismaClient, User } from "@prisma/client";
import bcrypt from "bcryptjs";
import { HttpError } from "./errors.js";
import { cleanName } from "./name-matching.js";
import { loginInput, signupInput, profileInput } from "../../src/lib/contracts.js";
import { createDemo, cleanupExpiredDemos } from "./demo.js";

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");
export const userDto = (user: User) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  upiId: user.upiId,
  color: user.color,
  demoExpiresAt: user.demoExpiresAt?.toISOString() ?? null,
});
const cookieName = () =>
  process.env.NODE_ENV === "production" ? "__Host-khata_session" : "khata_session";
const cookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
});
function tokenFrom(req: Request) {
  const item = req.headers.cookie
    ?.split(";")
    .map((s) => s.trim())
    .find((s) => s.startsWith(cookieName() + "="));
  const token = item?.slice(cookieName().length + 1);
  return token && /^[a-f0-9]{64}$/.test(token) ? token : undefined;
}
export function createAuth(db: PrismaClient) {
  const dummyHash = bcrypt.hash(randomBytes(32).toString("hex"), 12);
  async function session(req: Request) {
    const token = tokenFrom(req);
    if (!token) return null;
    const record = await db.session.findUnique({
      where: { tokenHash: hashToken(token) },
      include: { user: true },
    });
    if (
      !record ||
      record.expiresAt <= new Date() ||
      (record.user.demoExpiresAt && record.user.demoExpiresAt <= new Date())
    )
      return null;
    return record;
  }
  async function issue(
    req: Request,
    res: Response,
    user: User,
    activeGroupId: string | null = null,
    expiry?: Date,
  ) {
    const previous = tokenFrom(req);
    if (previous) await db.session.deleteMany({ where: { tokenHash: hashToken(previous) } });
    const token = randomBytes(32).toString("hex");
    const expiresAt = expiry ?? new Date(Date.now() + 7 * 86400000);
    await db.session.create({
      data: { tokenHash: hashToken(token), userId: user.id, activeGroupId, expiresAt },
    });
    res.cookie(cookieName(), token, {
      ...cookieOptions(),
      maxAge: expiresAt.getTime() - Date.now(),
    });
    res.setHeader("Cache-Control", "no-store");
    res.json({ user: userDto(user), activeGroupId });
  }
  const router = Router();
  const ipLimit = rateLimit({
    windowMs: 15 * 60000,
    limit: 40,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: { error: "Too many account requests. Please try later." },
  });
  const emailLimit = rateLimit({
    windowMs: 15 * 60000,
    limit: 15,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    keyGenerator: (req) =>
      hashToken(
        String(req.body?.email ?? "")
          .trim()
          .toLowerCase(),
      ),
    message: { error: "Too many account requests. Please try later." },
  });
  router.use((_req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    next();
  });
  router.post("/signup", ipLimit, emailLimit, async (req, res) => {
    const input = signupInput.parse(req.body);
    if (bcrypt.truncates(input.password))
      throw new HttpError(400, "Password must fit within 72 UTF-8 bytes.");
    const passwordHash = await bcrypt.hash(input.password, 12);
    const existing = await db.user.findUnique({ where: { email: input.email } });
    if (existing)
      throw new HttpError(409, "Unable to create account with these details. Try signing in.");
    const colors = ["#e9ad55", "#7bc8aa", "#e38c7d", "#9c8ed6", "#6ca9cf"];
    const user = await db.user.create({
      data: {
        name: input.name,
        email: input.email,
        passwordHash,
        color: colors[randomBytes(1)[0]! % colors.length]!,
      },
    });
    await issue(req, res, user);
  });
  router.post("/login", ipLimit, emailLimit, async (req, res) => {
    const input = loginInput.parse(req.body);
    const key = hashToken(input.email);
    const now = new Date();
    const attempt = await db.authAttempt.findUnique({ where: { key } });
    const user = await db.user.findUnique({ where: { email: input.email } });
    const matches = await bcrypt.compare(input.password, user?.passwordHash ?? (await dummyHash));
    if (attempt?.lockedUntil && attempt.lockedUntil > now)
      throw new HttpError(429, "Unable to sign in. Check your details or try again later.");
    if (!matches || !user?.passwordHash || user.demoExpiresAt || bcrypt.truncates(input.password)) {
      await db.authAttempt.updateMany({
        where: { key, windowStart: { lt: new Date(now.getTime() - 15 * 60000) } },
        data: { failures: 0, windowStart: now, lockedUntil: null },
      });
      const counter = await db.authAttempt.upsert({
        where: { key },
        create: { key, failures: 1, windowStart: now },
        update: { failures: { increment: 1 } },
      });
      if (counter.failures >= 5)
        await db.authAttempt.update({
          where: { key },
          data: { lockedUntil: new Date(Date.now() + 10 * 60000) },
        });
      throw new HttpError(401, "Unable to sign in. Check your details or try again later.");
    }
    await db.authAttempt.deleteMany({ where: { key } });
    const membership = await db.member.findFirst({
      where: { userId: user.id, status: "active" },
      orderBy: { joinedAt: "asc" },
    });
    await issue(req, res, user, membership?.groupId ?? null);
  });
  router.post(
    "/demo",
    rateLimit({
      windowMs: 3600000,
      limit: 5,
      standardHeaders: "draft-8",
      legacyHeaders: false,
      message: { error: "Demo limit reached. Please sign up or try later." },
    }),
    async (req, res) => {
      await cleanupExpiredDemos(db);
      const demo = await db.$transaction((tx) => createDemo(tx), { timeout: 60000 });
      await issue(req, res, demo.user, demo.groupId, demo.expiresAt);
    },
  );
  router.get("/me", async (req, res) => {
    const current = await session(req);
    if (current?.activeGroupId) {
      const member = await db.member.findFirst({
        where: { groupId: current.activeGroupId, userId: current.userId, status: "active" },
        include: { group: true },
      });
      if (!member || (member.group.expiresAt && member.group.expiresAt <= new Date())) {
        await db.session.update({
          where: { tokenHash: current.tokenHash },
          data: { activeGroupId: null },
        });
        current.activeGroupId = null;
      }
    }
    res.json({
      user: current ? userDto(current.user) : null,
      activeGroupId: current?.activeGroupId ?? null,
    });
  });
  router.post("/logout", ipLimit, async (req, res) => {
    const token = tokenFrom(req);
    if (token) await db.session.deleteMany({ where: { tokenHash: hashToken(token) } });
    res.clearCookie(cookieName(), cookieOptions());
    res.status(204).end();
  });
  router.patch("/profile", async (req, res) => {
    const current = await session(req);
    if (!current) throw new HttpError(401, "Please sign in.");
    const input = profileInput.parse(req.body);
    const user = await updateOwnProfile(db, current.userId, input);
    res.json(userDto(user));
  });
  return { router, session };
}
export async function updateOwnProfile(
  db: PrismaClient,
  userId: string,
  input: { name?: string; upiId?: string },
) {
  return db.$transaction(
    async (tx) => {
      if (input.name) {
        const own = await tx.member.findMany({
          where: { userId, status: { in: ["active", "pending"] } },
          select: { groupId: true },
        });
        const peers = await tx.member.findMany({
          where: {
            groupId: { in: own.map((m) => m.groupId) },
            userId: { not: userId },
            status: "active",
          },
          select: { name: true },
        });
        if (peers.some((m) => cleanName(m.name) === cleanName(input.name!)))
          throw new HttpError(
            409,
            "Choose a distinct name for your groups, for example your full name.",
          );
      }
      const user = await tx.user.update({
        where: { id: userId },
        data: { ...input, ...(input.upiId === "" ? { upiId: null } : {}) },
      });
      await tx.member.updateMany({
        where: { userId: user.id, status: { in: ["active", "pending"] } },
        data: { name: user.name, upiId: user.upiId },
      });
      return user;
    },
    { isolationLevel: "Serializable" },
  );
}
