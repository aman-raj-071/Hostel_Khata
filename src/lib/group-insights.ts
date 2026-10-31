import type { Balance, Group } from "./types";
import { activeMembers } from "./active-members";

export function nextPayers(group: Group, balances: Balance[]) {
  const active = balances.map((b) => ({ ...b, paise: Math.round(b.net * 100) }));
  if (
    active.some(
      (b) =>
        !Number.isSafeInteger(b.paise) ||
        Math.abs(b.net * 100 - b.paise) > 0.00001 ||
        !group.members.some((m) => m.id === b.memberId),
    ) ||
    new Set(active.map((b) => b.memberId)).size !== active.length ||
    active.length !== group.members.length ||
    active.reduce((sum, b) => sum + b.paise, 0) !== 0
  )
    throw new Error("Balances changed. Refresh the group and try again.");
  const eligible = activeMembers(group.members);
  const lowest = Math.min(
    0,
    ...active.filter((b) => eligible.some((m) => m.id === b.memberId)).map((b) => b.paise),
  );
  return lowest === 0
    ? []
    : eligible
        .filter((m) => active.some((b) => b.memberId === m.id && b.paise === lowest))
        .map((m) => ({ ...m, owedPaise: -lowest }));
}
