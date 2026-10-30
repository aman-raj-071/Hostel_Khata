import type { Member } from "../../src/lib/types.js";
export const cleanName = (name: string) =>
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
