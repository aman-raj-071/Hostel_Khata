import type { Balance, Group, Settlement } from "./types";

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
  const lowest = Math.min(0, ...active.map((b) => b.paise));
  return lowest === 0
    ? []
    : group.members
        .filter((m) => active.some((b) => b.memberId === m.id && b.paise === lowest))
        .map((m) => ({ ...m, owedPaise: -lowest }));
}

export function groupBriefing(group: Group, balances: Balance[], settlements: Settlement[]) {
  const suggested = nextPayers(group, balances);
  const remaining = new Map(balances.map((b) => [b.memberId, Math.round(b.net * 100)]));
  for (const payment of settlements) {
    const paise = Math.round(payment.amount * 100);
    if (
      !remaining.has(payment.fromId) ||
      !remaining.has(payment.toId) ||
      payment.fromId === payment.toId ||
      !Number.isSafeInteger(paise) ||
      paise <= 0 ||
      Math.abs(payment.amount * 100 - paise) > 0.00001
    )
      throw new Error("Payments changed. Refresh and try again.");
    remaining.set(payment.fromId, remaining.get(payment.fromId)! + paise);
    remaining.set(payment.toId, remaining.get(payment.toId)! - paise);
  }
  if ([...remaining.values()].some((value) => value !== 0))
    throw new Error("Balances changed while loading. Try again for a fresh briefing.");
  const name = (id: string) => group.members.find((m) => m.id === id)?.name ?? "Unknown member";
  const rupees = (amount: number) =>
    new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(
      amount,
    ) + " rupees";
  const lines = [group.name + " ka hisaab."];
  for (const b of balances)
    lines.push(
      name(b.memberId) +
        (Math.round(b.net * 100) === 0
          ? " settled hai."
          : b.net > 0
            ? " gets back " + rupees(b.net) + "."
            : " owes " + rupees(-b.net) + "."),
    );
  if (!suggested.length) lines.push("Sab barabar! No payments needed.");
  else {
    lines.push("Simplified payments:");
    for (const s of settlements)
      lines.push(name(s.fromId) + " pays " + name(s.toId) + " " + rupees(s.amount) + ".");
    lines.push(
      "Next shared buy ke liye " +
        suggested.map((m) => m.name).join(" ya ") +
        " volunteer kar sakte hain: current net dues sabse zyada hain. Yeh suggestion hai, payment record nahi.",
    );
  }
  return lines.join("\n");
}
