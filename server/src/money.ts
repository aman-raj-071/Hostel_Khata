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

function greedy(input: { memberId: string; netPaise: number }[]) {
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

export function simplify(input: { memberId: string; netPaise: number }[]) {
  if (new Set(input.map((balance) => balance.memberId)).size !== input.length)
    throw new Error("Member balances must be unique.");
  const baseline = greedy(input);
  const active = input.filter((balance) => balance.netPaise !== 0);
  const lowerBound = Math.max(
    active.filter((balance) => balance.netPaise < 0).length,
    active.filter((balance) => balance.netPaise > 0).length,
  );
  if (baseline.length === lowerBound) return baseline;
  // shortcut: exact partitioning is bounded to 16 nonzero balances; larger groups use greedy to keep public requests responsive.
  if (active.length > 16) return baseline;
  const size = 1 << active.length;
  const sums = new Float64Array(size);
  const groups = new Uint8Array(size);
  const last = new Uint8Array(size);
  for (let mask = 1; mask < size; mask++) {
    const bit = 31 - Math.clz32(mask & -mask);
    sums[mask] = sums[mask ^ (1 << bit)]! + active[bit]!.netPaise;
    if (!Number.isSafeInteger(sums[mask]))
      throw new Error("Balance totals exceed safe integer paise.");
    let best = -1;
    for (let remaining = mask; remaining; remaining &= remaining - 1) {
      const index = 31 - Math.clz32(remaining & -remaining);
      const count = groups[mask ^ (1 << index)]! + (sums[mask] === 0 ? 1 : 0);
      if (count > best) {
        best = count;
        last[mask] = index;
      }
    }
    groups[mask] = best;
  }
  const order: number[] = [];
  for (let mask = size - 1; mask;) {
    const index = last[mask]!;
    order.push(index);
    mask ^= 1 << index;
  }
  const payments: ReturnType<typeof greedy> = [];
  let group: typeof active = [],
    net = 0;
  for (const index of order.reverse()) {
    const member = active[index]!;
    group.push(member);
    net += member.netPaise;
    if (net === 0) {
      payments.push(...greedy(group));
      group = [];
    }
  }
  return payments.length < baseline.length ? payments : baseline;
}
