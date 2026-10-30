/** All app data enters through this HTTP boundary. Public signatures match types.ts. */
import type {
  Balance,
  Expense,
  Group,
  Member,
  ParseMode,
  ParsedExpense,
  Report,
  Settlement,
  Reminder,
  ReminderInput,
  Wrapped,
} from "./types";
import { z } from "zod";
import {
  balancesSchema,
  expenseSchema,
  groupSchema,
  memberSchema,
  parsedResponseSchema,
  reportSchema,
  settlementsSchema,
  reminderSchema,
  wrappedSchema,
} from "./contracts";
import { getDraftSource } from "./draft";

const baseUrl = (import.meta.env["VITE_API_URL"] || "http://127.0.0.1:3001").replace(/\/$/, "");

async function request<T>(
  path: string,
  schema: z.ZodType,
  method = "GET",
  body?: unknown,
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: body === undefined ? {} : { "Content-Type": "application/json" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(75000),
    });
  } catch {
    throw new Error("Couldn't reach Hostel Khata. Check your connection and try again.");
  }
  if (!response.ok) {
    const body: unknown = await response.json().catch(() => null);
    const error = z.object({ error: z.string() }).safeParse(body);
    throw new Error(
      error.success ? error.data.error : `Request failed (${response.status}). Please try again.`,
    );
  }
  if (response.status === 204) return schema.parse(undefined) as T;
  const result = schema.safeParse(await response.json().catch(() => null));
  if (!result.success)
    throw new Error("The server returned unexpected data. Please refresh and try again.");
  return result.data as T;
}

export async function getGroup(): Promise<Group> {
  return request("/api/group", groupSchema);
}
export async function addMember(name: string, upiId?: string): Promise<Member> {
  return request("/api/members", memberSchema, "POST", { name, upiId });
}
export async function updateMember(id: string, data: Partial<Member>): Promise<Member> {
  return request(`/api/members/${encodeURIComponent(id)}`, memberSchema, "PATCH", data);
}
export async function removeMember(id: string): Promise<void> {
  return request(`/api/members/${encodeURIComponent(id)}`, z.void(), "DELETE");
}

export async function parseText(
  text: string,
  mode: ParseMode,
): Promise<{ expenses: ParsedExpense[] }> {
  return request("/api/parse", parsedResponseSchema, "POST", { text, mode });
}
export async function saveExpenses(parsed: ParsedExpense[]): Promise<Expense[]> {
  return request("/api/expenses", z.array(expenseSchema), "POST", {
    expenses: parsed,
    rawText: getDraftSource(parsed),
  });
}
export async function listExpenses(filters?: {
  memberId?: string | undefined;
  q?: string | undefined;
  month?: string | undefined;
}): Promise<Expense[]> {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(filters ?? {})) if (value) query.set(key, value);
  return request(`/api/expenses${query.size ? `?${query}` : ""}`, z.array(expenseSchema));
}
export async function updateExpense(id: string, data: Partial<Expense>): Promise<Expense> {
  return request(`/api/expenses/${encodeURIComponent(id)}`, expenseSchema, "PATCH", data);
}
export async function deleteExpense(id: string): Promise<void> {
  return request(`/api/expenses/${encodeURIComponent(id)}`, z.void(), "DELETE");
}
export async function getBalances(): Promise<Balance[]> {
  return request("/api/balances", balancesSchema);
}
export async function getSettlements(): Promise<Settlement[]> {
  return request("/api/settlements", settlementsSchema);
}
export async function getReport(month: string): Promise<Report> {
  return request(`/api/report?month=${encodeURIComponent(month)}`, reportSchema);
}

export async function generateReminder(input: ReminderInput): Promise<Reminder> {
  return request("/api/reminder", reminderSchema, "POST", input);
}
export async function getWrapped(month: string): Promise<Wrapped> {
  return request(`/api/wrapped?month=${encodeURIComponent(month)}`, wrappedSchema);
}
