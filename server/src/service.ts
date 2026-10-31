import type { PrismaClient, Prisma } from "@prisma/client";
import type { Expense, Member, ParsedExpense, Report } from "../../src/lib/types.js";
import { HttpError } from "./errors.js";
import { balances, equalSplit, simplify, toPaise, toRupees } from "./money.js";
import { expenseSchema } from "./schemas.js";

type StoredExpense = Prisma.ExpenseGetPayload<{ include: { shares: true } }>;
export const memberDto = (m: {
  id: string;
  name: string;
  upiId: string | null;
  userId?: string | null;
  role?: string;
  status?: string;
}): Member => ({
  id: m.id,
  name: m.name,
  ...(m.upiId ? { upiId: m.upiId } : {}),
  ...(m.userId ? { userId: m.userId } : {}),
  ...(m.role ? { role: m.role as Member["role"] } : {}),
  ...(m.status ? { status: m.status as Member["status"] } : {}),
});
export const expenseDto = (e: StoredExpense): Expense => ({
  id: e.id,
  payerId: e.payerId,
  amount: toRupees(e.amountPaise),
  description: e.description,
  category: e.category as Expense["category"],
  date: e.date,
  ...(e.rawText ? { rawText: e.rawText } : {}),
  shares: e.shares.map((s) => ({ memberId: s.memberId, amount: toRupees(s.sharePaise) })),
});

export function validateExpense(expense: Expense, memberIds: string[]) {
  if (
    !memberIds.includes(expense.payerId) ||
    expense.shares.some((s) => !memberIds.includes(s.memberId))
  )
    throw new HttpError(422, "Choose only members of this group for the payer and shares.");
  if (new Set(expense.shares.map((s) => s.memberId)).size !== expense.shares.length)
    throw new HttpError(422, "Each member can have only one share.");
  if (expense.shares.reduce((sum, s) => sum + toPaise(s.amount), 0) !== toPaise(expense.amount))
    throw new HttpError(422, "Shares must add up exactly to the expense amount.");
}

export function createService(db: PrismaClient, code: string) {
  async function group(client: Prisma.TransactionClient = db) {
    const result = await client.group.findUnique({
      where: { code },
      include: {
        members: {
          where: {
            OR: [
              { status: { not: "pending" } },
              { payments: { some: {} } },
              { shares: { some: {} } },
            ],
          },
          orderBy: { name: "asc" },
        },
      },
    });
    if (!result) throw new HttpError(503, "Group access unavailable.");
    return result;
  }
  async function ledger() {
    return db.$transaction(
      async (tx) => {
        const g = await group(tx);
        const expenses = await tx.expense.findMany({
          where: { groupId: g.id },
          include: { shares: true },
        });
        return {
          group: g,
          balances: balances(
            g.members.map((m) => m.id),
            expenses,
          ),
        };
      },
      { isolationLevel: "Serializable" },
    );
  }
  async function list(filters: { memberId?: string; q?: string; month?: string } = {}) {
    const g = await group();
    const list = await db.expense.findMany({
      where: {
        groupId: g.id,
        ...(filters.month ? { date: { startsWith: filters.month } } : {}),
        ...(filters.memberId
          ? {
              OR: [
                { payerId: filters.memberId },
                { shares: { some: { memberId: filters.memberId } } },
              ],
            }
          : {}),
      },
      include: { shares: true, payer: true },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }, { id: "asc" }],
    });
    const q = filters.q?.toLowerCase();
    return list
      .filter(
        (e) =>
          !q || e.description.toLowerCase().includes(q) || e.payer.name.toLowerCase().includes(q),
      )
      .map(expenseDto);
  }
  return {
    group,
    async getGroup() {
      const g = await group();
      return {
        id: g.id,
        name: g.name,
        members: g.members.map(memberDto),
      };
    },
    list,
    async save(parsed: ParsedExpense[], rawText?: string) {
      return db.$transaction(async (tx) => {
        const g = await group(tx);
        const idFor = (name: string) => {
          const m = g.members.find(
            (m) => m.status === "active" && m.name.toLowerCase() === name.toLowerCase(),
          );
          if (!m)
            throw new HttpError(
              422,
              `Choose a group member for "${name || "the payer"}" before saving.`,
            );
          return m.id;
        };
        const output: Expense[] = [];
        for (const p of parsed) {
          if (p.description.trim().toLowerCase() === "settlement")
            throw new HttpError(
              422,
              "Record repayments in Settle. The receiver must confirm receipt.",
            );
          if (p.needsClarification)
            throw new HttpError(422, p.question || "Please confirm every expense before saving.");
          if (p.amount <= 0) throw new HttpError(422, "Enter a positive amount before saving.");
          const payerId = idFor(p.payer);
          const participants = p.participants.map(idFor);
          if (!participants.length || new Set(participants).size !== participants.length)
            throw new HttpError(422, "Pick at least one unique participant.");
          if (
            p.splitType === "equal" &&
            toPaise(p.amount) % participants.length &&
            !participants.includes(payerId)
          )
            throw new HttpError(
              422,
              "Include the payer to receive leftover paise, or choose an exact split.",
            );
          const shares =
            p.splitType === "equal"
              ? equalSplit(toPaise(p.amount), participants, payerId).map((s) => ({
                  memberId: s.memberId,
                  amount: toRupees(s.sharePaise),
                }))
              : p.shares.map((s) => ({ memberId: idFor(s.member), amount: s.amount }));
          if (
            shares.length !== participants.length ||
            shares.some((s) => !participants.includes(s.memberId))
          )
            throw new HttpError(422, "Shares must match participants exactly.");
          const e = expenseSchema.parse({
            id: "new",
            payerId,
            amount: p.amount,
            description: p.description,
            category: p.category,
            date: p.date,
            rawText,
            shares,
          });
          validateExpense(
            e,
            g.members.filter((m) => m.status === "active").map((m) => m.id),
          );
          const saved = await tx.expense.create({
            data: {
              groupId: g.id,
              payerId,
              amountPaise: toPaise(e.amount),
              description: e.description,
              category: e.category,
              date: e.date,
              rawText,
              shares: {
                create: shares.map((s) => ({
                  memberId: s.memberId,
                  sharePaise: toPaise(s.amount),
                })),
              },
            },
            include: { shares: true },
          });
          output.push(expenseDto(saved));
        }
        return output;
      });
    },
    async updateExpense(id: string, patch: Partial<Expense>) {
      return db.$transaction(async (tx) => {
        const g = await group(tx);
        const current = await tx.expense.findFirst({
          where: { id, groupId: g.id },
          include: { shares: true },
        });
        if (!current) throw new HttpError(404, "Expense not found");
        if (await tx.payment.count({ where: { groupId: g.id, settlementExpenseId: id } }))
          throw new HttpError(409, "Confirmed payments cannot be edited.");
        if (patch.description?.trim().toLowerCase() === "settlement")
          throw new HttpError(422, "Record repayments in Settle with receiver confirmation.");
        if (patch.id && patch.id !== id) throw new HttpError(400, "Expense ID cannot be changed");
        const next = expenseSchema.parse({ ...expenseDto(current), ...patch, id });
        const previous = expenseDto(current);
        const priorShares = new Map(previous.shares.map((s) => [s.memberId, s.amount]));
        const financialChanged =
          next.amount !== previous.amount ||
          next.payerId !== previous.payerId ||
          next.shares.length !== previous.shares.length ||
          next.shares.some((s) => priorShares.get(s.memberId) !== s.amount);
        validateExpense(
          next,
          g.members.filter((m) => !financialChanged || m.status === "active").map((m) => m.id),
        );
        return expenseDto(
          await tx.expense.update({
            where: { id: current.id },
            data: {
              payerId: next.payerId,
              amountPaise: toPaise(next.amount),
              description: next.description,
              category: next.category,
              date: next.date,
              rawText: next.rawText,
              shares: {
                deleteMany: {},
                create: next.shares.map((s) => ({
                  memberId: s.memberId,
                  sharePaise: toPaise(s.amount),
                })),
              },
            },
            include: { shares: true },
          }),
        );
      });
    },
    async deleteExpense(id: string) {
      const g = await group();
      if (await db.payment.count({ where: { groupId: g.id, settlementExpenseId: id } }))
        throw new HttpError(409, "Confirmed payments cannot be deleted.");
      const result = await db.expense.deleteMany({ where: { id, groupId: g.id } });
      if (!result.count) throw new HttpError(404, "Expense not found");
    },
    async getBalances() {
      const l = await ledger();
      return l.balances.map((b) => ({ memberId: b.memberId, net: toRupees(b.netPaise) }));
    },
    async getSettlements() {
      const l = await ledger();
      return simplify(l.balances).map((s) => ({
        fromId: s.fromId,
        toId: s.toId,
        amount: toRupees(s.amountPaise),
      }));
    },
    async report(month: string): Promise<Report> {
      return db.$transaction(
        async (tx) => {
          const g = await group(tx);
          const expenses = await tx.expense.findMany({
            where: { groupId: g.id, date: { startsWith: month } },
            include: { shares: true },
          });
          const byCategory: Record<string, number> = {};
          const paid = new Map(g.members.map((m) => [m.id, 0]));
          const owed = new Map(g.members.map((m) => [m.id, 0]));
          let total = 0;
          for (const e of expenses) {
            total += e.amountPaise;
            byCategory[e.category] = (byCategory[e.category] ?? 0) + e.amountPaise;
            paid.set(e.payerId, paid.get(e.payerId)! + e.amountPaise);
            for (const s of e.shares) owed.set(s.memberId, owed.get(s.memberId)! + s.sharePaise);
          }
          const byMember = g.members.map((m) => ({
            memberId: m.id,
            paid: toRupees(paid.get(m.id)!),
            owed: toRupees(owed.get(m.id)!),
          }));
          const currency = (n: number) =>
            `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
          const label = new Date(month + "-01T12:00:00Z").toLocaleDateString("en-IN", {
            month: "long",
            year: "numeric",
            timeZone: "Asia/Kolkata",
          });
          const summaryText = [
            `🏠 ${g.name} — ${label}`,
            `💸 Total: ${currency(toRupees(total))} (${expenses.length} entries)`,
            "",
            "📊 By category",
            ...Object.entries(byCategory).map(([c, v]) => `${c}: ${currency(toRupees(v))}`),
            "",
            "👥 Paid vs share",
            ...byMember.map(
              (b) =>
                `${g.members.find((m) => m.id === b.memberId)!.name}: paid ${currency(b.paid)}, share ${currency(b.owed)}`,
            ),
            "",
            "Includes recorded repayments.",
            "Sent from Hostel Khata",
          ].join("\n");
          return {
            total: toRupees(total),
            byCategory: Object.fromEntries(
              Object.entries(byCategory).map(([k, v]) => [k, toRupees(v)]),
            ),
            byMember,
            summaryText,
          };
        },
        { isolationLevel: "Serializable" },
      );
    },
    async addMember(data: { name: string; upiId?: string }) {
      const g = await group();
      if (g.members.some((m) => m.name.toLowerCase() === data.name.toLowerCase()))
        throw new HttpError(409, "A member with this name already exists");
      return memberDto(
        await db.member.create({
          data: { groupId: g.id, name: data.name, upiId: data.upiId || null },
        }),
      );
    },
    async updateMember(id: string, data: Partial<Member>) {
      return db.$transaction(async (tx) => {
        const g = await group(tx);
        if (!g.members.some((m) => m.id === id)) throw new HttpError(404, "Member not found");
        if (data.id && data.id !== id) throw new HttpError(400, "Member ID cannot be changed");
        if (
          data.name &&
          g.members.some((m) => m.id !== id && m.name.toLowerCase() === data.name!.toLowerCase())
        )
          throw new HttpError(409, "A member with this name already exists");
        return memberDto(
          await tx.member.update({
            where: { id },
            data: {
              ...(data.name !== undefined ? { name: data.name } : {}),
              ...(data.upiId !== undefined ? { upiId: data.upiId || null } : {}),
            },
          }),
        );
      });
    },
    async removeMember(id: string) {
      const g = await group();
      if (!g.members.some((m) => m.id === id)) throw new HttpError(404, "Member not found");
      if (
        await db.expense.count({
          where: { groupId: g.id, OR: [{ payerId: id }, { shares: { some: { memberId: id } } }] },
        })
      )
        throw new HttpError(409, "This member has expenses. Delete or edit those first.");
      await db.member.delete({ where: { id } });
    },
  };
}
