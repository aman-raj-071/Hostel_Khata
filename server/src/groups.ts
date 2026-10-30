import { Router, type Response } from "express";
import { randomBytes } from "node:crypto";
import { rateLimit } from "express-rate-limit";
import type { PrismaClient, Prisma, Session, User } from "@prisma/client";
import { z, idSchema, nameSchema } from "./schemas.js";
import { HttpError } from "./errors.js";
import { balances } from "./money.js";
import { memberDto } from "./service.js";
import { cleanName } from "./name-matching.js";

const unavailable = () => new HttpError(403, "Group access unavailable.");
const session = (res: Response) => res.locals.session as Session & { user: User };
const inviteCode = () =>
  [...randomBytes(10)].map((b) => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[b & 31]).join("");
const inviteInput = z
  .object({
    expiresAt: z.string().datetime().optional(),
    maxUses: z.number().int().min(1).max(1000).nullable().optional(),
  })
  .strict();
const joinInput = z
  .object({
    code: z
      .string()
      .trim()
      .min(8)
      .max(32)
      .transform((s) => s.replace(/[-\s]/g, "").toUpperCase()),
  })
  .strict();
function realAccount(res: Response) {
  if (session(res).user.demoExpiresAt)
    throw new HttpError(
      403,
      "Demo accounts stay in their sandbox. Sign up to create or join real groups.",
    );
}
export async function activeMembership(
  db: Prisma.TransactionClient,
  groupId: string,
  userId: string,
  admin = false,
) {
  const m = await db.member.findFirst({
    where: { groupId, userId, status: "active" },
    include: { group: true },
  });
  if (!m || (m.group.expiresAt && m.group.expiresAt <= new Date()) || (admin && m.role !== "admin"))
    throw unavailable();
  return m;
}
async function newInvite(
  tx: Prisma.TransactionClient,
  groupId: string,
  userId: string,
  input: z.infer<typeof inviteInput>,
) {
  const expiresAt = input.expiresAt
    ? new Date(input.expiresAt)
    : new Date(Date.now() + 7 * 86400000);
  if (expiresAt.getTime() <= Date.now() || expiresAt.getTime() > Date.now() + 90 * 86400000)
    throw new HttpError(400, "Invite expiry must be in the next 90 days.");
  return tx.groupInvite.create({
    data: {
      groupId,
      createdBy: userId,
      code: inviteCode(),
      expiresAt,
      maxUses: input.maxUses ?? null,
    },
  });
}
const inviteDto = (invite: {
  id: string;
  code: string;
  expiresAt: Date;
  maxUses: number | null;
  uses: number;
  revoked: boolean;
}) => ({ ...invite, expiresAt: invite.expiresAt.toISOString() });
export function createGroupsRouter(db: PrismaClient, joinLimit = 10) {
  const router = Router();
  router.get("/", async (_req, res) => {
    const rows = await db.member.findMany({
      where: {
        userId: session(res).userId,
        status: { in: ["active", "pending"] },
        group: { OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
      },
      include: { group: true },
      orderBy: { joinedAt: "asc" },
    });
    res.json(
      rows.map((m) => ({
        id: m.groupId,
        name: m.group.name,
        role: m.role,
        status: m.status,
        myMemberId: m.id,
        requireApproval: m.group.requireApproval,
      })),
    );
  });
  router.post("/", async (req, res) => {
    realAccount(res);
    const { name } = z.object({ name: nameSchema }).strict().parse(req.body);
    const current = session(res);
    const result = await db.$transaction(
      async (tx) => {
        const group = await tx.group.create({
          data: { name, code: randomBytes(24).toString("hex"), createdBy: current.userId },
        });
        await tx.member.create({
          data: {
            groupId: group.id,
            userId: current.userId,
            name: current.user.name,
            upiId: current.user.upiId,
            role: "admin",
          },
        });
        const invite = await newInvite(tx, group.id, current.userId, {});
        await tx.session.update({
          where: { tokenHash: current.tokenHash },
          data: { activeGroupId: group.id },
        });
        return { groupId: group.id, invite: inviteDto(invite) };
      },
      { isolationLevel: "Serializable" },
    );
    res.status(201).json(result);
  });
  const ipJoin = rateLimit({
    windowMs: 15 * 60000,
    limit: joinLimit,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: { error: "Too many join attempts. Please try later." },
  });
  const userJoin = rateLimit({
    windowMs: 15 * 60000,
    limit: joinLimit,
    keyGenerator: (_req, res) => session(res).userId,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: { error: "Too many join attempts. Please try later." },
  });
  router.post("/join", ipJoin, userJoin, async (req, res) => {
    realAccount(res);
    const input = joinInput.parse(req.body);
    const current = session(res);
    const key = "join:" + current.userId;
    const attempt = await db.authAttempt.findUnique({ where: { key } });
    if (attempt?.lockedUntil && attempt.lockedUntil > new Date())
      throw new HttpError(429, "Too many join attempts. Please try later.");
    try {
      const result = await db.$transaction(
        async (tx) => {
          const invite = await tx.groupInvite.findUnique({
            where: { code: input.code },
            include: { group: true },
          });
          if (!invite || invite.revoked || invite.expiresAt <= new Date() || invite.group.expiresAt)
            throw new HttpError(403, "Invite unavailable.");
          const previous = await tx.member.findUnique({
            where: { groupId_userId: { groupId: invite.groupId, userId: current.userId } },
          });
          if (previous && ["active", "pending"].includes(previous.status))
            return { groupId: invite.groupId, status: previous.status };
          const used = await tx.groupInvite.updateMany({
            where: {
              id: invite.id,
              revoked: false,
              expiresAt: { gt: new Date() },
              ...(invite.maxUses === null ? {} : { uses: { lt: invite.maxUses } }),
            },
            data: { uses: { increment: 1 } },
          });
          if (!used.count) throw new HttpError(403, "Invite unavailable.");
          const status = invite.group.requireApproval ? "pending" : "active";
          const peers = await tx.member.findMany({
            where: { groupId: invite.groupId, userId: { not: current.userId }, status: "active" },
            select: { name: true },
          });
          if (peers.some((m) => cleanName(m.name) === cleanName(current.user.name)))
            throw new HttpError(
              409,
              "Choose a distinct profile name, for example your full name, before joining.",
            );
          await tx.member.upsert({
            where: { groupId_userId: { groupId: invite.groupId, userId: current.userId } },
            create: {
              groupId: invite.groupId,
              userId: current.userId,
              name: current.user.name,
              upiId: current.user.upiId,
              status,
            },
            update: {
              status,
              role: "member",
              name: current.user.name,
              upiId: current.user.upiId,
              joinedAt: new Date(),
            },
          });
          if (status === "active")
            await tx.session.update({
              where: { tokenHash: current.tokenHash },
              data: { activeGroupId: invite.groupId },
            });
          return { groupId: invite.groupId, status };
        },
        { isolationLevel: "Serializable" },
      );
      await db.authAttempt.deleteMany({ where: { key } });
      res.json(result);
    } catch (error) {
      if (error instanceof HttpError && error.status === 403) {
        const now = new Date();
        await db.authAttempt.updateMany({
          where: { key, windowStart: { lt: new Date(Date.now() - 15 * 60000) } },
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
      }
      throw error;
    }
  });
  router.post("/:id/select", async (req, res) => {
    const groupId = idSchema.parse(req.params.id);
    await activeMembership(db, groupId, session(res).userId);
    await db.session.update({
      where: { tokenHash: session(res).tokenHash },
      data: { activeGroupId: groupId },
    });
    res.status(204).end();
  });
  router.get("/:id/members", async (req, res) => {
    const groupId = idSchema.parse(req.params.id);
    const actor = await activeMembership(db, groupId, session(res).userId);
    const members = await db.member.findMany({
      where: { groupId, ...(actor.role === "admin" ? {} : { status: { not: "pending" } }) },
      include: { user: { select: { color: true } } },
      orderBy: { joinedAt: "asc" },
    });
    res.json(
      members.map((m) => ({
        ...memberDto(m),
        userId: m.userId,
        role: m.role,
        status: m.status,
        color: m.user?.color,
      })),
    );
  });
  router.get("/:id/invites", async (req, res) => {
    const groupId = idSchema.parse(req.params.id);
    await activeMembership(db, groupId, session(res).userId, true);
    const invites = await db.groupInvite.findMany({
      where: { groupId },
      orderBy: { createdAt: "desc" },
      take: 10,
    });
    res.json(invites.map(inviteDto));
  });
  router.post("/:id/invites", async (req, res) => {
    const groupId = idSchema.parse(req.params.id);
    const input = inviteInput.parse(req.body);
    const current = session(res);
    await activeMembership(db, groupId, current.userId, true);
    const invite = await db.$transaction(
      async (tx) => {
        await activeMembership(tx, groupId, current.userId, true);
        await tx.groupInvite.updateMany({
          where: { groupId, revoked: false },
          data: { revoked: true },
        });
        return newInvite(tx, groupId, current.userId, input);
      },
      { isolationLevel: "Serializable" },
    );
    res.status(201).json(inviteDto(invite));
  });
  router.delete("/:id/invites/:inviteId", async (req, res) => {
    const groupId = idSchema.parse(req.params.id);
    await activeMembership(db, groupId, session(res).userId, true);
    const result = await db.groupInvite.updateMany({
      where: { id: idSchema.parse(req.params.inviteId), groupId },
      data: { revoked: true },
    });
    if (!result.count) throw unavailable();
    res.status(204).end();
  });
  router.patch("/:id/settings", async (req, res) => {
    const groupId = idSchema.parse(req.params.id);
    await activeMembership(db, groupId, session(res).userId, true);
    const input = z.object({ requireApproval: z.boolean() }).strict().parse(req.body);
    await db.group.update({ where: { id: groupId }, data: input });
    res.status(204).end();
  });
  router.post("/:id/members/:memberId/:action", async (req, res) => {
    const groupId = idSchema.parse(req.params.id);
    const memberId = idSchema.parse(req.params.memberId);
    const action = z.enum(["approve", "reject"]).parse(req.params.action);
    await db.$transaction(
      async (tx) => {
        await activeMembership(tx, groupId, session(res).userId, true);
        if (action === "approve") {
          const target = await tx.member.findFirst({
            where: { id: memberId, groupId, status: "pending" },
          });
          if (!target) throw unavailable();
          const peers = await tx.member.findMany({
            where: { groupId, status: "active" },
            select: { name: true },
          });
          if (peers.some((m) => cleanName(m.name) === cleanName(target.name)))
            throw new HttpError(
              409,
              "The requester needs a distinct profile name before approval.",
            );
        }
        const changed = await tx.member.updateMany({
          where: { id: memberId, groupId, status: "pending" },
          data: { status: action === "approve" ? "active" : "removed" },
        });
        if (!changed.count) throw unavailable();
        if (action === "approve") {
          const target = await tx.member.findUniqueOrThrow({ where: { id: memberId } });
          if (target.userId)
            await tx.session.updateMany({
              where: { userId: target.userId, activeGroupId: null },
              data: { activeGroupId: groupId },
            });
        }
      },
      { isolationLevel: "Serializable" },
    );
    res.status(204).end();
  });
  router.delete("/:id/members/:memberId", async (req, res) => {
    await removeGroupMember(
      db,
      idSchema.parse(req.params.id),
      session(res).userId,
      idSchema.parse(req.params.memberId),
    );
    res.status(204).end();
  });
  router.post("/:id/leave", async (req, res) => {
    const groupId = idSchema.parse(req.params.id);
    const current = session(res);
    await db.$transaction(
      async (tx) => {
        const actor = await activeMembership(tx, groupId, current.userId);
        const members = await tx.member.findMany({ where: { groupId } });
        const expenses = await tx.expense.findMany({
          where: { groupId },
          include: { shares: true },
        });
        const net = balances(
          members.map((m) => m.id),
          expenses,
        ).find((b) => b.memberId === actor.id)!.netPaise;
        if (net !== 0) throw new HttpError(409, "Settle your balance before leaving this group.");
        if (
          actor.role === "admin" &&
          !members.some((m) => m.id !== actor.id && m.status === "active" && m.role === "admin")
        )
          throw new HttpError(409, "Transfer admin or delete the group before leaving.");
        await tx.member.update({ where: { id: actor.id }, data: { status: "removed" } });
        await tx.session.updateMany({
          where: { userId: current.userId, activeGroupId: groupId },
          data: { activeGroupId: null },
        });
      },
      { isolationLevel: "Serializable" },
    );
    res.status(204).end();
  });
  router.post("/:id/transfer-admin", async (req, res) => {
    const groupId = idSchema.parse(req.params.id);
    const input = z.object({ memberId: idSchema }).strict().parse(req.body);
    await db.$transaction(
      async (tx) => {
        const actor = await activeMembership(tx, groupId, session(res).userId, true);
        const target = await tx.member.findFirst({
          where: { id: input.memberId, groupId, status: "active" },
        });
        if (!target || target.id === actor.id) throw unavailable();
        await tx.member.update({ where: { id: actor.id }, data: { role: "member" } });
        await tx.member.update({ where: { id: target.id }, data: { role: "admin" } });
      },
      { isolationLevel: "Serializable" },
    );
    res.status(204).end();
  });
  router.delete("/:id", async (req, res) => {
    const groupId = idSchema.parse(req.params.id);
    await activeMembership(db, groupId, session(res).userId, true);
    await db.$transaction(
      async (tx) => {
        await activeMembership(tx, groupId, session(res).userId, true);
        await tx.session.updateMany({
          where: { activeGroupId: groupId },
          data: { activeGroupId: null },
        });
        await tx.expense.deleteMany({ where: { groupId } });
        await tx.member.deleteMany({ where: { groupId } });
        await tx.group.delete({ where: { id: groupId } });
      },
      { isolationLevel: "Serializable" },
    );
    res.status(204).end();
  });
  return router;
}
export async function removeGroupMember(
  db: PrismaClient,
  groupId: string,
  userId: string,
  memberId: string,
) {
  await db.$transaction(
    async (tx) => {
      const actor = await activeMembership(tx, groupId, userId, true);
      if (actor.id === memberId)
        throw new HttpError(409, "Use Leave group, or transfer admin first.");
      const target = await tx.member.findFirst({
        where: { id: memberId, groupId, status: { in: ["active", "pending"] } },
      });
      if (!target) throw unavailable();
      await tx.member.update({ where: { id: memberId }, data: { status: "removed" } });
      if (target.userId)
        await tx.session.updateMany({
          where: { userId: target.userId, activeGroupId: groupId },
          data: { activeGroupId: null },
        });
    },
    { isolationLevel: "Serializable" },
  );
}
