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
  sessionSchema,
  userSchema,
  groupSummarySchema,
  inviteSchema,
  groupCreationSchema,
  groupJoinSchema,
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
      credentials: "include",
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

export type Account = z.infer<typeof userSchema>;
export type AccountSession = z.infer<typeof sessionSchema>;
export const getSession = (): Promise<AccountSession> => request("/api/auth/me", sessionSchema);
export const signup = (name: string, email: string, password: string): Promise<AccountSession> =>
  request("/api/auth/signup", sessionSchema, "POST", { name, email, password });
export const login = (email: string, password: string): Promise<AccountSession> =>
  request("/api/auth/login", sessionSchema, "POST", { email, password });
export const logout = (): Promise<void> => request("/api/auth/logout", z.void(), "POST", {});
export const tryDemo = (): Promise<AccountSession> =>
  request("/api/auth/demo", sessionSchema, "POST", {});
export const updateProfile = (data: { name?: string; upiId?: string }): Promise<Account> =>
  request("/api/auth/profile", userSchema, "PATCH", data);

export type GroupSummary = z.infer<typeof groupSummarySchema>;
export type GroupInvite = z.infer<typeof inviteSchema>;
export const listGroups = (): Promise<GroupSummary[]> =>
  request("/api/groups", z.array(groupSummarySchema));
export const createGroup = (name: string): Promise<z.infer<typeof groupCreationSchema>> =>
  request("/api/groups", groupCreationSchema, "POST", { name });
export const joinGroup = (code: string): Promise<z.infer<typeof groupJoinSchema>> =>
  request("/api/groups/join", groupJoinSchema, "POST", { code });
export const selectGroup = (id: string): Promise<void> =>
  request("/api/groups/" + encodeURIComponent(id) + "/select", z.void(), "POST", {});
export const listGroupMembers = (id: string): Promise<Member[]> =>
  request("/api/groups/" + encodeURIComponent(id) + "/members", z.array(memberSchema));
export const listInvites = (id: string): Promise<GroupInvite[]> =>
  request("/api/groups/" + encodeURIComponent(id) + "/invites", z.array(inviteSchema));
export const regenerateInvite = (
  id: string,
  options: { expiresAt?: string; maxUses?: number | null },
): Promise<GroupInvite> =>
  request("/api/groups/" + encodeURIComponent(id) + "/invites", inviteSchema, "POST", options);
export const revokeInvite = (id: string, inviteId: string): Promise<void> =>
  request(
    "/api/groups/" + encodeURIComponent(id) + "/invites/" + encodeURIComponent(inviteId),
    z.void(),
    "DELETE",
  );
export const setGroupApproval = (id: string, requireApproval: boolean): Promise<void> =>
  request("/api/groups/" + encodeURIComponent(id) + "/settings", z.void(), "PATCH", {
    requireApproval,
  });
export const decideMember = (
  id: string,
  memberId: string,
  decision: "approve" | "reject",
): Promise<void> =>
  request(
    "/api/groups/" +
      encodeURIComponent(id) +
      "/members/" +
      encodeURIComponent(memberId) +
      "/" +
      decision,
    z.void(),
    "POST",
    {},
  );
export const removeGroupMember = (id: string, memberId: string): Promise<void> =>
  request(
    "/api/groups/" + encodeURIComponent(id) + "/members/" + encodeURIComponent(memberId),
    z.void(),
    "DELETE",
  );
export const leaveGroup = (id: string): Promise<void> =>
  request("/api/groups/" + encodeURIComponent(id) + "/leave", z.void(), "POST", {});
export const transferAdmin = (id: string, memberId: string): Promise<void> =>
  request("/api/groups/" + encodeURIComponent(id) + "/transfer-admin", z.void(), "POST", {
    memberId,
  });
export const deleteGroup = (id: string): Promise<void> =>
  request("/api/groups/" + encodeURIComponent(id), z.void(), "DELETE");
