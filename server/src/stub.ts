import type { ParsedExpense, Category } from "../../src/lib/types.js";
import type { ModelInput } from "./parser.js";

// shortcut: offline fixtures cover common phrases, use Claude for real language understanding.
export function keywordStub(input: ModelInput): { expenses: ParsedExpense[] } {
  const expenses: ParsedExpense[] = [];
  for (const line of input.text.split(/\n+|\baur phir\b/i)) {
    const chat = line.match(/(?:^| - )([^:]+):\s*(.*)$/);
    const text = chat?.[2] ?? line;
    const lower = text.toLowerCase();
    if (!/\d|sau|hazaar|chai|dinner|maggi|wifi|bill|sabzi|bhej|paid|kharcha/.test(lower)) continue;
    const found = text.match(/(?:rs\.?\s*|₹\s*)?(\d+(?:\.\d{1,2})?)(k)?\b/i);
    const amount = found
      ? Number(found[1]) * (found[2] ? 1000 : 1)
      : /dedh sau/.test(lower)
        ? 150
        : /dhai sau/.test(lower)
          ? 250
          : /paanch sau/.test(lower)
            ? 500
            : /hazaar/.test(lower)
              ? 1000
              : /sau/.test(lower)
                ? 100
                : 0;
    const namedPayer = text.match(/\b([\p{L}]+)(?:\s+bhai)?\s+ne\b/u)?.[1];
    const sender = chat?.[1]?.trim().split(/ - /).pop();
    const payer = namedPayer ?? sender ?? input.speaker ?? "";
    const mentioned = input.members.filter((m) => lower.includes(m.toLowerCase()));
    const excluded = mentioned.filter((m) => {
      const name = m.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      return new RegExp(`${name}\\s+(nahi|nhi|not)|(?:except|without|bina)\\s+${name}`, "i").test(
        text,
      );
    });
    const everyone = /sab|everyone|all|barabar/.test(lower);
    const explicit = /saath|sath|with/.test(lower);
    let participants = (
      explicit && mentioned.length
        ? [...new Set([payer, ...mentioned].filter(Boolean))]
        : input.members
    ).filter((m) => !excluded.includes(m));
    let category: Category = /wifi|bill|gas|bijli|water/.test(lower)
      ? "utilities"
      : /doodh|sabzi|atta|groc|milk/.test(lower)
        ? "groceries"
        : /auto|uber|ola|petrol/.test(lower)
          ? "travel"
          : /rent|kiraya/.test(lower)
            ? "rent"
            : /chai|dinner|maggi|pizza|swiggy|biryani|lunch/.test(lower)
              ? "food"
              : "other";
    const receiver = text.match(/\b([\p{L}]+)\s+ko\b/u)?.[1];
    const settlement = !!receiver && /bhej|wapas|paid back|settle/.test(lower);
    if (settlement) {
      participants = [receiver!];
      category = "other";
    }
    const date = new Date(input.today + "T12:00:00Z");
    date.setUTCDate(
      date.getUTCDate() - (/parso/.test(lower) ? 2 : /kal|yesterday/.test(lower) ? 1 : 0),
    );
    const question = !amount
      ? "Kitna kharcha hua?"
      : !payer
        ? "Kisne pay kiya?"
        : !everyone && !explicit && !settlement
          ? "Kaun kaun is kharche mein tha?"
          : null;
    expenses.push({
      payer,
      amount,
      description: settlement
        ? "Settlement"
        : /maggi/i.test(text)
          ? "Maggi"
          : /wifi/i.test(text)
            ? "Wifi bill"
            : /dinner/i.test(text)
              ? "Dinner"
              : text.slice(0, 80),
      category,
      date: date.toISOString().slice(0, 10),
      splitType: settlement ? "exact" : "equal",
      participants,
      shares: settlement && amount ? [{ member: receiver!, amount }] : [],
      confidence: question ? 0.4 : 0.9,
      needsClarification: !!question,
      question,
    });
  }
  return { expenses };
}
