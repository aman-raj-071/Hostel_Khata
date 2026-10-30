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
    (v) => Math.abs(v * 100 - Math.round(v * 100)) < 0.00001,
    "Amounts must have at most two decimal places",
  );
export const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((v) => {
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
});
export const upiSchema = z
  .string()
  .trim()
  .max(100)
  .refine(
    (s) => s === "" || /^[\w.-]{2,}@[a-zA-Z][a-zA-Z0-9.-]{1,}$/.test(s),
    "Use a valid UPI ID, such as name@okaxis",
  );
export const memberInput = z.object({ name: nameSchema, upiId: upiSchema.optional() }).strict();
export const memberPatch = memberInput.partial().extend({ id: idSchema.optional() }).strict();
export const expenseSchema = z.object({
  id: idSchema,
  payerId: idSchema,
  amount: moneySchema.refine((v) => v > 0, "Amount must be positive"),
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
  .refine((v) => v.expenses.length > 0, "Add at least one expense");
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
    amount: moneySchema.refine((value) => value > 0, "Amount must be positive"),
    tone: z.enum(["polite", "filmy", "mummy", "savage"]),
  })
  .strict()
  .refine((value) => value.fromId !== value.toId, "Choose two different members");
export const reminderSchema = z
  .object({
    message: z
      .string()
      .trim()
      .min(1)
      .max(600)
      .refine((value) => value.split(/\r?\n/).length <= 3, "Use at most three lines"),
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
  .refine((v) => Object.keys(v).length > 0, "Provide profile fields");
