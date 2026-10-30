import { z, parsedExpenseSchema } from "./contracts";
import type { ParsedExpense } from "./types";

const checkpointSchema = z
  .object({
    version: z.literal(1),
    groupId: z.string().min(1),
    savedAt: z.number().int(),
    source: z.string().max(20000).optional(),
    expenses: z.array(parsedExpenseSchema).min(1).max(100),
  })
  .strict();
export type Checkpoint = z.infer<typeof checkpointSchema>;
const key = (groupId: string) => "khata-review-v1:" + groupId;
const TTL = 7 * 24 * 60 * 60 * 1000;

export function loadCheckpoint(
  storage: Storage,
  groupId: string,
  now = Date.now(),
): Checkpoint | null {
  try {
    const raw = storage.getItem(key(groupId));
    if (!raw) return null;
    if (raw.length > 256000) throw new Error("Oversize checkpoint");
    const parsed = checkpointSchema.safeParse(JSON.parse(raw));
    if (
      !parsed.success ||
      parsed.data.groupId !== groupId ||
      parsed.data.savedAt > now ||
      now - parsed.data.savedAt > TTL
    ) {
      storage.removeItem(key(groupId));
      return null;
    }
    return parsed.data;
  } catch {
    return null;
  }
}

export function storeCheckpoint(
  storage: Storage,
  groupId: string,
  expenses: ParsedExpense[],
  source?: string,
  now = Date.now(),
): boolean {
  try {
    if (!expenses.length) {
      storage.removeItem(key(groupId));
      return true;
    }
    const data = checkpointSchema.parse({ version: 1, groupId, savedAt: now, source, expenses });
    const raw = JSON.stringify(data);
    if (raw.length > 256000) return false;
    storage.setItem(key(groupId), raw);
    return true;
  } catch {
    return false;
  }
}
