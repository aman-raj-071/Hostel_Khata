import { Router } from "express";
import type { Payment, Prisma, PrismaClient } from "@prisma/client";
import { z, idSchema, paymentInput, paymentSchema } from "./schemas.js";
import { activeMembership } from "./groups.js";
import { balances, toPaise, toRupees } from "./money.js";
import { HttpError } from "./errors.js";
import { indiaToday } from "./parser.js";

export const paymentDto = (p: Payment) =>
  paymentSchema.parse({
    id: p.id,
    groupId: p.groupId,
    fromUserId: p.fromUserId,
    toUserId: p.toUserId,
    amount: toRupees(p.amountPaise),
    status: p.status,
    upiRef: p.upiRef,
    note: p.note,
    createdAt: p.createdAt.toISOString(),
    confirmedAt: p.confirmedAt?.toISOString() ?? null,
  });

async function parties(
  tx: Prisma.TransactionClient,
  groupId: string,
  fromUserId: string,
  toUserId: string,
) {
  if (fromUserId === toUserId) throw new HttpError(422, "Choose a different receiver.");
  const from = await activeMembership(tx, groupId, fromUserId);
  const to = await activeMembership(tx, groupId, toUserId);
  return { from, to };
}

async function checkOwed(
  tx: Prisma.TransactionClient,
  groupId: string,
  fromId: string,
  toId: string,
  amountPaise: number,
  exceptId?: string,
) {
  const members = await tx.member.findMany({ where: { groupId } });
  const expenses = await tx.expense.findMany({ where: { groupId }, include: { shares: true } });
  const net = balances(
    members.map((m) => m.id),
    expenses,
  );
  const from = members.find((m) => m.id === fromId)!;
  const to = members.find((m) => m.id === toId)!;
  const pending = await tx.payment.findMany({
    where: { groupId, status: "pending", ...(exceptId ? { id: { not: exceptId } } : {}) },
  });
  const reservedFrom = pending
    .filter((p) => p.fromUserId === from.userId)
    .reduce((s, p) => s + p.amountPaise, 0);
  const reservedTo = pending
    .filter((p) => p.toUserId === to.userId)
    .reduce((s, p) => s + p.amountPaise, 0);
  const available = Math.min(
    -net.find((b) => b.memberId === fromId)!.netPaise - reservedFrom,
    net.find((b) => b.memberId === toId)!.netPaise - reservedTo,
  );
  if (amountPaise > available)
    throw new HttpError(
      409,
      "Amount exceeds the current unpaid balance. Refresh balances or cancel an earlier pending claim.",
    );
}

async function recordSettlement(
  tx: Prisma.TransactionClient,
  p: Payment,
  fromId: string,
  toId: string,
) {
  const expense = await tx.expense.create({
    data: {
      groupId: p.groupId,
      payerId: fromId,
      amountPaise: p.amountPaise,
      description: "Settlement",
      category: "other",
      date: indiaToday(),
      rawText: p.note || "Receiver confirmed receipt",
      shares: { create: { memberId: toId, sharePaise: p.amountPaise } },
    },
  });
  return tx.payment.update({
    where: { id: p.id },
    data: { status: "confirmed", confirmedAt: new Date(), settlementExpenseId: expense.id },
  });
}

export function createPaymentsRouter(db: PrismaClient) {
  const router = Router();
  router.get("/", async (_req, res) => {
    const groupId = res.locals.membership.groupId as string;
    const rows = await db.payment.findMany({ where: { groupId }, orderBy: { createdAt: "desc" } });
    res.json(rows.map(paymentDto));
  });
  router.post("/", async (req, res) => {
    const input = paymentInput.parse(req.body);
    const actor = res.locals.session.userId as string;
    if (input.fromUserId !== actor)
      throw new HttpError(403, "Only the payer can submit a payment claim.");
    const groupId = res.locals.membership.groupId as string;
    const result = await db.$transaction(
      async (tx) => {
        const { from, to } = await parties(tx, groupId, actor, input.toUserId);
        const amountPaise = toPaise(input.amount);
        await checkOwed(tx, groupId, from.id, to.id, amountPaise);
        return tx.payment.create({
          data: {
            groupId,
            fromUserId: actor,
            toUserId: input.toUserId,
            amountPaise,
            upiRef: input.upiRef || null,
            note: input.note ?? "",
          },
        });
      },
      { isolationLevel: "Serializable" },
    );
    res.status(201).json(paymentDto(result));
  });
  router.post("/cash", async (req, res) => {
    const input = paymentInput.parse(req.body);
    const actor = res.locals.session.userId as string;
    if (input.toUserId !== actor)
      throw new HttpError(403, "Only the receiver can record cash received.");
    const groupId = res.locals.membership.groupId as string;
    const result = await db.$transaction(
      async (tx) => {
        const { from, to } = await parties(tx, groupId, input.fromUserId, actor);
        const amountPaise = toPaise(input.amount);
        await checkOwed(tx, groupId, from.id, to.id, amountPaise);
        const p = await tx.payment.create({
          data: {
            groupId,
            fromUserId: input.fromUserId,
            toUserId: actor,
            amountPaise,
            note: input.note || "Received in cash",
          },
        });
        return recordSettlement(tx, p, from.id, to.id);
      },
      { isolationLevel: "Serializable" },
    );
    res.status(201).json(paymentDto(result));
  });
  router.post("/:id/:action", async (req, res) => {
    const id = idSchema.parse(req.params.id);
    const action = z.enum(["confirm", "dispute", "cancel"]).parse(req.params.action);
    z.object({}).strict().parse(req.body);
    const actor = res.locals.session.userId as string;
    const groupId = res.locals.membership.groupId as string;
    const result = await db.$transaction(
      async (tx) => {
        await activeMembership(tx, groupId, actor);
        const p = await tx.payment.findFirst({ where: { id, groupId } });
        if (!p) throw new HttpError(404, "Payment not found.");
        if ((action === "cancel" ? p.fromUserId : p.toUserId) !== actor)
          throw new HttpError(
            403,
            action === "cancel"
              ? "Only the payer can cancel."
              : "Only the receiver can confirm or dispute.",
          );
        const target =
          action === "confirm" ? "confirmed" : action === "dispute" ? "disputed" : "cancelled";
        if (p.status === target) return p;
        if (p.status !== "pending") throw new HttpError(409, "This payment is already resolved.");
        if (action !== "confirm")
          return tx.payment.update({ where: { id }, data: { status: target } });
        const { from, to } = await parties(tx, groupId, p.fromUserId, p.toUserId);
        await checkOwed(tx, groupId, from.id, to.id, p.amountPaise, p.id);
        const claimed = await tx.payment.updateMany({
          where: { id, groupId, status: "pending" },
          data: { status: "confirmed" },
        });
        if (!claimed.count) throw new HttpError(409, "Payment changed. Refresh and try again.");
        return recordSettlement(tx, p, from.id, to.id);
      },
      { isolationLevel: "Serializable" },
    );
    res.json(paymentDto(result));
  });
  return router;
}
