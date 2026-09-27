export type Currency = "EUR" | "USD";
export type TransactionType = "INCOME" | "EXPENSE";
export type TransactionSource = "WEB" | "OPENCLAW";
export type CategoryType = "INCOME" | "EXPENSE" | "BOTH";

export interface TransactionQuery {
  from?: string;
  to?: string;
  categoryId?: string;
  type?: TransactionType;
  search?: string;
  page?: number;
  limit?: number;
}

export interface CreateTransactionInput {
  type: TransactionType;
  amount: number;
  currency: Currency;
  concept: string;
  date: string;
  notes?: string;
  categoryId: string;
  accountId: string;
  source?: TransactionSource;
  externalId?: string;
}

export type UpdateTransactionInput = Partial<
  Omit<CreateTransactionInput, "source" | "externalId">
>;

export interface Account {
  id: string;
  name: string;
  initialBalance: string;
  currency: Currency;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
  currentBalance: string;
}

export interface Category {
  id: string;
  name: string;
  type: CategoryType;
  color: string | null;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Transaction {
  id: string;
  type: TransactionType;
  amount: string;
  currency: Currency;
  accountAmount: string;
  exchangeRate: string;
  concept: string;
  date: string;
  notes: string | null;
  source: TransactionSource;
  externalId: string | null;
  transferId: string | null;
  accountId: string;
  categoryId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Paginated<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

export interface DashboardByCategory {
  categoryId: string | null;
  name: string | null;
  total: string;
}

export interface DashboardSummary {
  from: string | null;
  to: string | null;
  currency: Currency;
  income: string;
  expense: string;
  balance: string;
  count: number;
  byCategory: DashboardByCategory[];
}
