import type { PrismaClient, Prisma } from "@prisma/client";
import { randomBytes } from "node:crypto";
import { demoRows } from "./demo-fixtures.js";
import { equalSplit, toPaise } from "./money.js";
import { indiaToday } from "./parser.js";

export async function cleanupExpiredDemos(db: PrismaClient, now = new Date()) {
  await db.session.deleteMany({ where: { expiresAt: { lte: now } } });
  await db.authAttempt.deleteMany({
    where: { windowStart: { lt: new Date(now.getTime() - 86400000) } },
  });
  const expired = await db.user.findMany({
    where: { demoExpiresAt: { lte: now } },
    select: { id: true },
  });
  if (!expired.length) return;
  const ids = expired.map((u) => u.id);
  await db.$transaction(
    async (tx) => {
      const groups = await tx.group.findMany({
        where: { createdBy: { in: ids }, expiresAt: { lte: now } },
        select: { id: true },
      });
      const groupIds = groups.map((g) => g.id);
      await tx.payment.deleteMany({ where: { groupId: { in: groupIds } } });
      await tx.expense.deleteMany({ where: { groupId: { in: groupIds } } });
      await tx.member.deleteMany({ where: { groupId: { in: groupIds } } });
      await tx.group.deleteMany({ where: { id: { in: groupIds } } });
      await tx.session.deleteMany({
        where: { OR: [{ userId: { in: ids } }, { expiresAt: { lte: now } }] },
      });
      await tx.user.deleteMany({ where: { id: { in: ids }, memberships: { none: {} } } });
    },
    { timeout: 30000 },
  );
}
export async function createDemo(tx: Prisma.TransactionClient) {
  const expiresAt = new Date(Date.now() + 86400000);
  const names = ["Kabir", "Aman", "Riya", "Dev", "Sneha"];
  const colors = ["#e9ad55", "#7bc8aa", "#e38c7d", "#9c8ed6", "#6ca9cf"];
  const group = await tx.group.create({
    data: { name: "Flat 302", code: randomBytes(24).toString("hex"), expiresAt },
  });
  const users = [];
  const members: { id: string }[] = [];
  for (let i = 0; i < names.length; i++) {
    const user = await tx.user.create({
      data: {
        name: names[i]!,
        email: randomBytes(16).toString("hex") + "@demo.invalid",
        color: colors[i]!,
        demoExpiresAt: expiresAt,
        upiId: names[i]!.toLowerCase() + "@example",
      },
    });
    users.push(user);
    members.push(
      await tx.member.create({
        data: {
          groupId: group.id,
          userId: user.id,
          name: user.name,
          upiId: user.upiId,
          role: i === 0 ? "admin" : "member",
        },
      }),
    );
  }
  await tx.group.update({ where: { id: group.id }, data: { createdBy: users[0]!.id } });
  for (const [payer, amount, description, category, days, people, rawText] of demoRows) {
    const date = new Date(indiaToday() + "T12:00:00Z");
    date.setUTCDate(date.getUTCDate() - days);
    const payerId = members[payer]!.id;
    await tx.expense.create({
      data: {
        groupId: group.id,
        payerId,
        amountPaise: toPaise(amount),
        description,
        category,
        date: date.toISOString().slice(0, 10),
        rawText,
        shares: {
          create: equalSplit(
            toPaise(amount),
            people.map((i) => members[i]!.id),
            payerId,
          ),
        },
      },
    });
  }
  return { user: users[0]!, groupId: group.id, expiresAt };
}
