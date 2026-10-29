export interface Member {
  id: string;
  name: string;
  upiId?: string;
}

export type Category = "food" | "rent" | "utilities" | "travel" | "groceries" | "other";

export interface Expense {
  id: string;
  payerId: string;
  amount: number;
  description: string;
  category: Category;
  date: string;
  rawText?: string;
  shares: { memberId: string; amount: number }[];
}

export interface ParsedExpense {
  payer: string;
  amount: number;
  description: string;
  category: string;
  date: string;
  splitType: "equal" | "exact" | "percent" | "itemized";
  participants: string[];
  shares: { member: string; amount: number }[];
  confidence: number;
  needsClarification: boolean;
  question: string | null;
}

export interface Balance {
  memberId: string;
  net: number;
}

export interface Settlement {
  fromId: string;
  toId: string;
  amount: number;
}

export interface Group {
  id: string;
  name: string;
  members: Member[];
}

export interface Report {
  total: number;
  byCategory: Record<string, number>;
  byMember: { memberId: string; paid: number; owed: number }[];
  summaryText: string;
}

export type ParseMode = "brain-dump" | "chat-import";
