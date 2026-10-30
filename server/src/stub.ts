import type { ParsedExpense, Category } from "../../src/lib/types.js";
import type { ModelInput } from "./parser.js";
import { matchMember } from "./name-matching.js";
import { equalSplit, toPaise, toRupees } from "./money.js";

const foods = "paneer|dal|rice|roti|naan|chai|dinner|lunch|maggi|pizza|swiggy|biryani";
const expenseWords = new RegExp(
  foods +
    "|wifi|bill|gas|bijli|water|doodh|sabzi|atta|milk|auto|uber|ola|petrol|rent|kiraya|kharcha|paid|bhej|wapas|udhaar|spent|grocery",
  "i",
);
const escape = (name: string) => name.replace(/[.*+?^$()|[\]{}\\]/g, "\\$&");
const numbers = (text: string) =>
  text
    .replace(/\bdedh sau\b/gi, "150")
    .replace(/\bdhai sau\b/gi, "250")
    .replace(/\bpaanch sau\b/gi, "500")
    .replace(/\bsau\b/gi, "100")
    .replace(/\bhazaar\b/gi, "1000")
    .replace(/\b(\d+(?:\.\d+)?)k\b/gi, (_, n: string) => String(Number(n) * 1000));

// shortcut: deterministic offline grammar covers documented demo phrases; unsupported wording stays in review for clarification.
export function keywordStub(input: ModelInput): { expenses: ParsedExpense[] } {
  const expenses: ParsedExpense[] = [];
  const members = input.members.map((name) => ({ id: name, name }));
  const resolve = (name: string) => matchMember(name.trim(), members)?.name ?? name.trim();
  const names = (text: string) => {
    const found = new Set<string>();
    for (const member of input.members)
      if (new RegExp("(?<![\\p{L}])" + escape(member) + "(?![\\p{L}])", "iu").test(text))
        found.add(member);
    for (const token of text.match(/[\p{L}]+/gu) ?? []) {
      const match = matchMember(token, members);
      if (
        !/^(main|maine|mera|mere|mein|ne|ka|ki|ke|ko|aur|all|dal|gas|day|paid)$/i.test(token) &&
        match
      )
        found.add(match.name);
    }
    if (/\b(me|mere|maine|myself|I)\b/i.test(text) && input.speaker) found.add(input.speaker);
    for (const token of text.match(/[\p{L}]+/gu) ?? []) {
      if (
        !/^(me|mere|maine|myself|I|aur|and|bhai|ke|liye|saath|sath|split|tha|thi|ka|ki|sab|sabne|barabar|everyone|all)$/i.test(
          token,
        ) &&
        !matchMember(token, members)
      )
        found.add(token);
    }
    return [...found];
  };
  const participantsFor = (
    text: string,
    payer: string,
  ): { participants: string[]; known: boolean } => {
    const excluded: string[] = [];
    for (const match of text.matchAll(
      /([\p{L}]+\+?)\s+(?:nahi|nhi|not)|(?:except|without|bina)\s+([\p{L}]+\+?)/giu,
    ))
      excluded.push(resolve(match[1] ?? match[2]!));
    const subset =
      text.match(/(?:sirf|only|with|split with)\s+(.+?)(?:\s+(?:ke liye|tha|thi)|$)/i)?.[1] ??
      text.match(/(?:,|\bwith\b)\s*(.+?)\s+(?:ke saath|ke sath|ke liye)/i)?.[1];
    const all = /\b(sab|sabne|everyone|all|barabar)\b/i.test(text);
    const participants = subset ? names(subset) : input.members;
    if (subset && /saath|sath|with/i.test(text) && payer && !participants.includes(payer))
      participants.unshift(payer);
    return {
      participants: participants.filter((name) => !excluded.includes(name)),
      known:
        (all || !!subset) &&
        excluded.every((name) => input.members.includes(name)) &&
        (!subset || names(subset).length > 0),
    };
  };
  for (const raw of input.text.split(/\n+/)) {
    const stamp = raw.match(
      /^\[?(\d{1,2})\/(\d{1,2})\/(\d{2,4}),?\s+\d{1,2}:\d{2}(?:\s*[ap]m)?\]?\s*[-–]?\s*/i,
    );
    const chatLine = raw.slice(stamp?.[0].length ?? 0);
    const chat = input.mode === "chat-import" ? chatLine.match(/^([^:]+):\s*(.*)$/) : null;
    const sender = chat ? resolve(chat[1]!) : null;
    const body = chat?.[2] ?? chatLine;
    if (
      /^(?:sab|sabne|everyone|all)\s*(?:\d+\s*(?:log|people))?\s*barabar[.!]?\s*$/i.test(
        body.trim(),
      )
    ) {
      const previous = [...expenses].reverse().find((e) => !sender || e.payer === sender);
      if (previous) {
        previous.participants = [...input.members];
        previous.needsClarification = !previous.amount || !previous.payer;
        previous.question = previous.needsClarification ? previous.question : null;
      }
      continue;
    }
    const clauses = body.split(
      new RegExp(
        String.raw`\baur phir\b|;|,\s*(?=[\p{L}]+\s+ne\b)|\s+aur\s+(?=(?:` +
          foods +
          String.raw`|wifi|doodh|gas|auto|sabzi)\b)`,
        "iu",
      ),
    );
    for (const clause of clauses) {
      const text = numbers(clause.trim());
      if (!expenseWords.test(text)) continue;
      const lower = text.toLowerCase();
      const namedPayer = text.match(/\b([\p{L}]+)(?:\s+bhai)?\s+ne\b/u)?.[1];
      const payer = resolve(namedPayer ?? sender ?? input.speaker ?? "");
      const found = text.match(/(?<![\d.])-?\d+(?:\.\d{1,2})?(?![\d.])/);
      const uncertain = /-+\d|\b(?:ya|or|around|shayad|approx)\b/i.test(text);
      let amount = uncertain ? 0 : Number(found?.[0] ?? 0);
      let question: string | null = uncertain ? "Sahi amount kitna tha?" : null;
      const receiver = text.match(/\b([\p{L}]+)\s+ko\b/u)?.[1];
      const settlement = !!receiver && /bhej|wapas|paid back|settle|de diya/.test(lower);
      const split = participantsFor(text, payer);
      let participants = settlement ? [resolve(receiver!)] : split.participants;
      let shares: ParsedExpense["shares"] =
        settlement && amount ? [{ member: participants[0]!, amount }] : [];
      let splitType: ParsedExpense["splitType"] = settlement ? "exact" : "equal";
      const allocations = [
        ...text.matchAll(/\b([\p{L}]+)\s+(\d+(?:\.\d{1,2})?)\s*(%|percent)?/gu),
      ].filter((m) => !!matchMember(m[1]!, members));
      if (!settlement && allocations.length) {
        splitType = allocations.some((m) => m[3]) ? "percent" : "exact";
        participants = allocations.map((m) => resolve(m[1]!));
        if (splitType === "percent") {
          if (
            allocations.some((m) => !m[3]) ||
            allocations.reduce((sum, m) => sum + Number(m[2]), 0) !== 100
          )
            question = "Percentages ko 100% tak confirm karo.";
          else {
            const total = toPaise(amount);
            shares = allocations.map((m) => ({
              member: resolve(m[1]!),
              amount: Math.floor((total * Number(m[2])) / 100),
            }));
            const remainder = total - shares.reduce((sum, s) => sum + s.amount, 0);
            const target = shares.find((s) => s.member === payer) ?? shares[0]!;
            target.amount += remainder;
            shares = shares.map((s) => ({ ...s, amount: toRupees(s.amount) }));
          }
        } else {
          shares = allocations.map((m) => ({ member: resolve(m[1]!), amount: Number(m[2]) }));
          const sum = shares.reduce((n, s) => n + toPaise(s.amount), 0);
          if (found && text.slice(0, found.index).trim().endsWith(allocations[0]![1]!))
            amount = toRupees(sum);
          if (sum !== toPaise(amount)) {
            shares = [];
            question = "Har person ka amount total se match karo.";
          }
        }
      }
      const items = [...text.matchAll(/\b(paneer|dal|rice|roti|naan)\b/gi)];
      if (!settlement && items.length >= 2) {
        splitType = "itemized";
        const totals = new Map<string, number>();
        let itemTotal = 0;
        for (let i = 0; i < items.length; i++) {
          const fragment = text.slice(items[i]!.index, items[i + 1]?.index);
          const price = fragment.match(/\d+(?:\.\d{1,2})?/);
          const itemSplit = participantsFor(fragment, payer);
          if (!price || !itemSplit.known || !itemSplit.participants.length) {
            question = "Har item ki price aur participants batao.";
            continue;
          }
          const paise = toPaise(Number(price[0]));
          itemTotal += paise;
          for (const share of equalSplit(
            paise,
            itemSplit.participants,
            itemSplit.participants.includes(payer) ? payer : itemSplit.participants[0]!,
          ))
            totals.set(share.memberId, (totals.get(share.memberId) ?? 0) + share.sharePaise);
        }
        if (found && found.index! < items[0]!.index! && toPaise(amount) !== itemTotal)
          question = "Item prices total se match nahi kar rahe. Confirm karo.";
        if (!question) {
          amount = toRupees(itemTotal);
          shares = [...totals].map(([member, paise]) => ({ member, amount: toRupees(paise) }));
          participants = shares.map((s) => s.member);
        } else shares = [];
      }
      if (!settlement && /\b(baaki|udhaar)\b/.test(lower) && !/\b(sab|sabne|barabar)\b/.test(lower))
        question = "Yeh naya kharcha hai ya pehle ka udhaar? Confirm karo.";
      question ??= !amount
        ? "Kitna kharcha hua?"
        : !payer
          ? "Kisne pay kiya?"
          : !split.known && splitType === "equal"
            ? "Kaun kaun is kharche mein tha?"
            : null;
      const date = new Date(input.today + "T12:00:00Z");
      if (stamp)
        date.setUTCFullYear(
          Number(stamp[3]!.length === 2 ? "20" + stamp[3] : stamp[3]),
          Number(stamp[2]) - 1,
          Number(stamp[1]),
        );
      date.setUTCDate(
        date.getUTCDate() -
          (/\bparso\b/.test(lower) ? 2 : /\b(kal|yesterday)\b/.test(lower) ? 1 : 0),
      );
      const category: Category = settlement
        ? "other"
        : /wifi|bill|gas|bijli|water/.test(lower)
          ? "utilities"
          : /doodh|sabzi|atta|groc|milk/.test(lower)
            ? "groceries"
            : /auto|uber|ola|petrol/.test(lower)
              ? "travel"
              : /rent|kiraya/.test(lower)
                ? "rent"
                : new RegExp(foods).test(lower)
                  ? "food"
                  : "other";
      expenses.push({
        payer,
        amount,
        description: settlement ? "Settlement" : text.slice(0, 80),
        category,
        date: date.toISOString().slice(0, 10),
        splitType,
        participants,
        shares,
        confidence: question ? 0.4 : 0.9,
        needsClarification: !!question,
        question,
      });
    }
  }
  return { expenses };
}
