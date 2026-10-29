import Anthropic from "@anthropic-ai/sdk";
import type { Member, ParsedExpense, ParseMode } from "../../src/lib/types.js";
import { PARSE_SYSTEM_PROMPT, buildParseUserMessage } from "../prompts/parsePrompt.js";
import { HttpError } from "./errors.js";
import { equalSplit, toPaise, toRupees } from "./money.js";
import { parsedResponseSchema } from "./schemas.js";
import { keywordStub } from "./stub.js";

export const indiaToday = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
const cleanName = (name: string) =>
  name
    .toLocaleLowerCase()
    .normalize("NFKC")
    .replace(/\b(bhai|bhaiya|didi|bro|ji)\b/g, "")
    .replace(/[^\p{L}\p{N}]/gu, "");

function distance(a: string, b: string) {
  let row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const next = [i];
    for (let j = 1; j <= b.length; j++)
      next[j] = Math.min(
        next[j - 1]! + 1,
        row[j]! + 1,
        row[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    row = next;
  }
  return row[b.length]!;
}

export function matchMember(name: string, members: Member[]): Member | undefined {
  const key = cleanName(name);
  if (!key) return undefined;
  const exact = members.filter((m) => cleanName(m.name) === key);
  if (exact.length) return exact.length === 1 ? exact[0] : undefined;
  // Only accept a unique close match; arbitrary nicknames require clarification.
  const ranked = members
    .map((member) => ({ member, score: distance(key, cleanName(member.name)) }))
    .sort((a, b) => a.score - b.score);
  const best = ranked[0];
  const limit = key.length >= 6 ? 2 : key.length >= 3 ? 1 : 0;
  return best && best.score <= limit && best.score !== ranked[1]?.score ? best.member : undefined;
}

export function normalizeParsed(expense: ParsedExpense, members: Member[]): ParsedExpense {
  const problems: string[] = [];
  const resolve = (name: string) => {
    const member = matchMember(name, members);
    if (!member) problems.push(`Who is "${name || "the payer"}"? Choose a group member.`);
    return member?.name ?? name;
  };
  const payer = resolve(expense.payer);
  const participants = expense.participants.map(resolve);
  let shares = expense.shares.map((s) => ({ ...s, member: resolve(s.member) }));
  if (
    new Set(participants).size !== participants.length ||
    new Set(shares.map((s) => s.member)).size !== shares.length
  )
    throw new Error("Duplicate participants or shares after matching names");
  if (!participants.length) problems.push("Who shares this expense?");
  if (expense.amount === 0) problems.push("What was the amount?");
  if (expense.splitType === "equal" && expense.amount > 0 && participants.length) {
    try {
      shares = equalSplit(toPaise(expense.amount), participants, payer).map((s) => ({
        member: s.memberId,
        amount: toRupees(s.sharePaise),
      }));
    } catch (error) {
      problems.push((error as Error).message);
    }
  } else if (expense.amount > 0) {
    if (!shares.length && expense.needsClarification)
      problems.push("Confirm the amounts per person, or explicitly switch to an equal split.");
    else {
      if (shares.reduce((sum, s) => sum + toPaise(s.amount), 0) !== toPaise(expense.amount))
        throw new Error("Shares must sum exactly to the total amount in paise");
      if (
        participants.length !== shares.length ||
        shares.some((s) => !participants.includes(s.member))
      )
        throw new Error("Shares must match participants exactly");
    }
  }
  const needsClarification = expense.needsClarification || problems.length > 0;
  return {
    ...expense,
    payer,
    participants,
    shares,
    needsClarification,
    confidence: needsClarification ? Math.min(expense.confidence, 0.6) : expense.confidence,
    question: needsClarification
      ? [...new Set([expense.question, ...problems].filter(Boolean))].join(" ") ||
        "Please confirm this expense."
      : null,
  };
}

export type ModelInput = {
  text: string;
  members: string[];
  speaker: string | null;
  today: string;
  mode: ParseMode;
};
export type Completion = (input: ModelInput, validationError?: string) => Promise<string>;

export const claudeCompletion: Completion = async (input, validationError) => {
  if (process.env.USE_CLAUDE_STUB === "true") return JSON.stringify(keywordStub(input));
  if (!process.env.ANTHROPIC_API_KEY) throw new HttpError(503, "ANTHROPIC_API_KEY not configured");
  if (!process.env.ANTHROPIC_MODEL) throw new HttpError(503, "ANTHROPIC_MODEL not configured");
  const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
    timeout: 30000,
    maxRetries: 0,
  });
  try {
    const response = await client.messages.create({
      model: process.env.ANTHROPIC_MODEL,
      temperature: 0,
      max_tokens: 8192,
      system:
        PARSE_SYSTEM_PROMPT +
        (validationError
          ? `\nYour previous output failed validation: ${validationError}. Return corrected JSON for the entire input.`
          : ""),
      messages: [{ role: "user", content: buildParseUserMessage(input) }],
    });
    if (response.stop_reason === "max_tokens")
      throw new Error("Output was truncated; return a shorter complete JSON response");
    return response.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("");
  } catch (error) {
    if (error instanceof Anthropic.APIError || error instanceof Anthropic.APIConnectionError)
      throw new HttpError(502, "The expense parser is unavailable. Please try again shortly.");
    throw error;
  }
};

export async function parseExpenses(
  input: Omit<ModelInput, "members" | "today" | "speaker"> & { speaker?: string },
  members: Member[],
  complete: Completion = claudeCompletion,
) {
  const message: ModelInput = {
    ...input,
    speaker: input.speaker ?? null,
    today: indiaToday(),
    members: members.map((m) => m.name),
  };
  let validationError: string | undefined;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const raw = await complete(message, validationError);
      const parsed = parsedResponseSchema.parse(JSON.parse(raw));
      return parsedResponseSchema.parse({
        expenses: parsed.expenses.map((e) => normalizeParsed(e, members)),
      });
    } catch (error) {
      if (error instanceof HttpError) throw error;
      validationError = (error as Error).message.slice(0, 3000);
    }
  }
  throw new HttpError(
    422,
    "We couldn't reliably understand these expenses. Try shorter sentences with the payer, amount and participants.",
  );
}
