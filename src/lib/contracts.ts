import { z } from "zod";
export { z, ZodError } from "zod";
const MAX_PAISE = 2_147_483_647;

export const categorySchema = z.enum(["food", "rent", "utilities", "travel", "groceries", "other"]);
export const nameSchema = z.string().trim().min(1).max(80);
export const idSchema = z.string().min(1).max(100);
export const moneySchema = z
  .number()
  .finite()
  .min(0)
  .max(MAX_PAISE / 100)
  .refine(
    (v: number) => Math.abs(v * 100 - Math.round(v * 100)) < 0.00001,
    "Amounts must have at most two decimal places",
  );
export const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((v: string) => {
    const d = new Date(v + "T00:00:00Z");
    return (
      !Number.isNaN(d.getTime()) &&
      d.toISOString().slice(0, 10) === v &&
      v >= "1900-01-01" &&
      v <= "9999-12-31"
    );
  }, "Use a real calendar date (YYYY-MM-DD)");
export const monthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);
export const memberSchema = z.object({
  id: idSchema,
  name: nameSchema,
  upiId: z.string().optional(),
  userId: idSchema.nullable().optional(),
  role: z.enum(["admin", "member"]).optional(),
  status: z.enum(["active", "pending", "removed"]).optional(),
  color: z.string().optional(),
});
export const upiSchema = z
  .string()
  .trim()
  .max(100)
  .refine(
    (s: string) => s === "" || /^[\w.-]{2,}@[a-zA-Z][a-zA-Z0-9.-]{1,}$/.test(s),
    "Use a valid UPI ID, such as name@okaxis",
  );
export const memberInput = z.object({ name: nameSchema, upiId: upiSchema.optional() }).strict();
export const memberPatch = memberInput.partial().extend({ id: idSchema.optional() }).strict();
export const expenseSchema = z.object({
  id: idSchema,
  payerId: idSchema,
  amount: moneySchema.refine((v: number) => v > 0, "Amount must be positive"),
  description: z.string().trim().min(1).max(300),
  category: categorySchema,
  date: dateSchema,
  rawText: z.string().max(20000).optional(),
  shares: z
    .array(z.object({ memberId: idSchema, amount: moneySchema }).strict())
    .min(1)
    .max(100),
});
export const expensePatch = expenseSchema.partial().strict();
export const parsedExpenseSchema = z
  .object({
    payer: z.string().trim().max(80),
    amount: moneySchema,
    description: z.string().trim().min(1).max(300),
    category: categorySchema,
    date: dateSchema,
    splitType: z.enum(["equal", "exact", "percent", "itemized"]),
    participants: z.array(nameSchema).max(100),
    shares: z.array(z.object({ member: nameSchema, amount: moneySchema }).strict()).max(100),
    confidence: z.number().min(0).max(1),
    needsClarification: z.boolean(),
    question: z.string().max(1000).nullable(),
  })
  .strict();
export const parsedResponseSchema = z
  .object({ expenses: z.array(parsedExpenseSchema).max(100) })
  .strict();
export const parseInput = z
  .object({
    text: z.string().trim().min(1).max(20000),
    mode: z.enum(["brain-dump", "chat-import"]),
    speaker: nameSchema.optional(),
  })
  .strict();
export const saveInput = parsedResponseSchema
  .extend({ rawText: z.string().max(20000).optional() })
  .refine((v: { expenses: unknown[] }) => v.expenses.length > 0, "Add at least one expense");
export const filtersSchema = z
  .object({
    memberId: idSchema.optional(),
    q: z.string().trim().max(300).optional(),
    month: monthSchema.optional(),
  })
  .strict();
export const groupSchema = z.object({
  id: idSchema,
  name: nameSchema,
  members: z.array(memberSchema),
  myMemberId: idSchema.optional(),
  myRole: z.enum(["admin", "member"]).optional(),
  requireApproval: z.boolean().optional(),
});
export const balancesSchema = z.array(z.object({ memberId: idSchema, net: z.number().finite() }));
export const settlementsSchema = z.array(
  z.object({ fromId: idSchema, toId: idSchema, amount: z.number().positive().finite() }),
);
export const reportSchema = z.object({
  total: z.number().finite(),
  byCategory: z.record(z.string(), z.number().finite()),
  byMember: z.array(
    z.object({ memberId: idSchema, paid: z.number().finite(), owed: z.number().finite() }),
  ),
  summaryText: z.string(),
});

export const reminderInput = z
  .object({
    fromId: idSchema,
    toId: idSchema,
    amount: moneySchema.refine((value: number) => value > 0, "Amount must be positive"),
    tone: z.enum(["polite", "filmy", "mummy", "savage"]),
  })
  .strict()
  .refine((value: { fromId: string; toId: string }) => value.fromId !== value.toId, "Choose two different members");
export const reminderSchema = z
  .object({
    message: z
      .string()
      .trim()
      .min(1)
      .max(600)
      .refine((value: string) => value.split(/\r?\n/).length <= 3, "Use at most three lines"),
  })
  .strict();

export const wrappedSchema = z
  .object({
    total: z.number().finite().nonnegative(),
    awards: z
      .array(
        z.object({
          title: z.string().min(1).max(80),
          memberId: idSchema.nullable(),
          value: z.number().finite().nonnegative(),
          emoji: z.string().max(20),
          line: z.string().trim().min(1).max(240),
        }),
      )
      .max(5),
    biggestExpense: expenseSchema.nullable(),
  })
  .strict();

export const userSchema = z.object({
  id: idSchema,
  name: nameSchema,
  email: z.string().email(),
  upiId: z.string().nullable(),
  color: z.string(),
  demoExpiresAt: z.string().nullable(),
});
export const sessionSchema = z.object({
  user: userSchema.nullable(),
  activeGroupId: idSchema.nullable(),
});
export const loginInput = z
  .object({
    email: z.string().trim().toLowerCase().email().max(254),
    password: z.string().min(8).max(72),
  })
  .strict();
export const signupInput = loginInput.extend({ name: nameSchema });
export const profileInput = z
  .object({ name: nameSchema.optional(), upiId: upiSchema.optional() })
  .strict()
  .refine((v: object) => Object.keys(v).length > 0, "Provide profile fields");

export const groupSummarySchema = z.object({
  id: idSchema,
  name: nameSchema,
  role: z.enum(["admin", "member"]),
  status: z.enum(["active", "pending"]),
  myMemberId: idSchema,
  requireApproval: z.boolean(),
});
export const inviteSchema = z.object({
  id: idSchema,
  code: z.string(),
  expiresAt: z.string(),
  maxUses: z.number().nullable(),
  uses: z.number(),
  revoked: z.boolean(),
});
export const groupCreationSchema = z.object({ groupId: idSchema, invite: inviteSchema });
export const groupJoinSchema = z.object({
  groupId: idSchema,
  status: z.enum(["active", "pending"]),
});

export const paymentInput = z
  .object({
    fromUserId: idSchema,
    toUserId: idSchema,
    amount: moneySchema.refine((v: number) => v > 0, "Amount must be positive"),
    upiRef: z.string().trim().max(100).optional(),
    note: z.string().trim().max(500).optional(),
  })
  .strict();
export const paymentSchema = z.object({
  id: idSchema,
  groupId: idSchema,
  fromUserId: idSchema,
  toUserId: idSchema,
  amount: moneySchema.refine((v: number) => v > 0),
  status: z.enum(["pending", "confirmed", "disputed", "cancelled"]),
  upiRef: z.string().nullable(),
  note: z.string(),
  createdAt: z.string().datetime(),
  confirmedAt: z.string().datetime().nullable(),
});
