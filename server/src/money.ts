export const MAX_PAISE = 2_147_483_647;

export function toPaise(rupees: number): number {
  const paise = Math.round(rupees * 100);
  if (
    !Number.isFinite(rupees) ||
    paise < 0 ||
    paise > MAX_PAISE ||
    Math.abs(rupees * 100 - paise) > 0.00001
  ) {
    throw new Error("Use a valid amount with at most two decimal places.");
  }
  return paise;
}

export const toRupees = (paise: number) => paise / 100;

export function equalSplit(amountPaise: number, participants: string[], payer: string) {
  if (
    !Number.isSafeInteger(amountPaise) ||
    amountPaise <= 0 ||
    amountPaise > MAX_PAISE ||
    !participants.length ||
    new Set(participants).size !== participants.length
  ) {
    throw new Error("Pick at least one unique participant and a positive amount.");
  }
  const each = Math.floor(amountPaise / participants.length);
  const remainder = amountPaise % participants.length;
  if (remainder && !participants.includes(payer)) {
    throw new Error(
      "Include the payer for an equal split with leftover paise, or use an exact split.",
    );
  }
  return participants.map((memberId) => ({
    memberId,
    sharePaise: each + (memberId === payer ? remainder : 0),
  }));
}

export interface LedgerExpense {
  payerId: string;
  amountPaise: number;
  shares: { memberId: string; sharePaise: number }[];
}

export function balances(memberIds: string[], expenses: LedgerExpense[]) {
  const net = new Map(memberIds.map((id) => [id, 0]));
  for (const expense of expenses) {
    net.set(expense.payerId, net.get(expense.payerId)! + expense.amountPaise);
    for (const share of expense.shares)
      net.set(share.memberId, net.get(share.memberId)! - share.sharePaise);
  }
  return [...net].map(([memberId, netPaise]) => ({ memberId, netPaise }));
}

export function simplify(input: { memberId: string; netPaise: number }[]) {
  if (
    input.some((b) => !Number.isSafeInteger(b.netPaise)) ||
    input.reduce((sum, b) => sum + b.netPaise, 0) !== 0
  ) {
    throw new Error("Balances must be integer paise and sum to zero.");
  }
  const debtors = input
    .filter((b) => b.netPaise < 0)
    .map((b) => ({ id: b.memberId, remaining: -b.netPaise }));
  const creditors = input
    .filter((b) => b.netPaise > 0)
    .map((b) => ({ id: b.memberId, remaining: b.netPaise }));
  const result: { fromId: string; toId: string; amountPaise: number }[] = [];
  const largestFirst = (
    a: { id: string; remaining: number },
    b: { id: string; remaining: number },
  ) => b.remaining - a.remaining || a.id.localeCompare(b.id);
  // shortcut: greedy does not guarantee the global fewest transfers, upgrade only if exact optimization is required.
  while (debtors.some((b) => b.remaining) && creditors.some((b) => b.remaining)) {
    debtors.sort(largestFirst);
    creditors.sort(largestFirst);
    const debtor = debtors[0]!;
    const creditor = creditors[0]!;
    const amountPaise = Math.min(debtor.remaining, creditor.remaining);
    result.push({ fromId: debtor.id, toId: creditor.id, amountPaise });
    debtor.remaining -= amountPaise;
    creditor.remaining -= amountPaise;
  }
  return result;
}
