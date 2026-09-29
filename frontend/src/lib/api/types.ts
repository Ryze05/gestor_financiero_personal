export type Currency = "EUR" | "USD";
export type TransactionType = "INCOME" | "EXPENSE";
export type TransactionSource = "WEB" | "OPENCLAW";
export type CategoryType = "INCOME" | "EXPENSE" | "BOTH";

export interface ExchangeRate {
  from: Currency;
  to: Currency;
  rate: string;
}

export interface TransactionQuery {
  from?: string;
  to?: string;
  categoryId?: string;
  accountId?: string;
  receiptId?: string;
  type?: TransactionType;
  source?: TransactionSource;
  minAmount?: number;
  maxAmount?: number;
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

export interface TransferQuery {
  from?: string;
  to?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export interface Transfer {
  id: string;
  amount: string;
  sourceCurrency: Currency;
  destinationAmount: string;
  destinationCurrency: Currency;
  exchangeRate: string;
  date: string;
  concept: string | null;
  sourceAccountId: string;
  destinationAccountId: string;
  createdAt: string;
  updatedAt: string;
  sourceAccount?: AccountBase;
  destinationAccount?: AccountBase;
}

export interface CreateTransferInput {
  amount: number;
  date: string;
  sourceAccountId: string;
  destinationAccountId: string;
  concept?: string;
}

export type UpdateTransferInput = Partial<CreateTransferInput>;

export interface AccountBase {
  id: string;
  name: string;
  initialBalance: string;
  currency: Currency;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Account extends AccountBase {
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

export interface Receipt {
  id: string;
  externalId: string;
  merchant: string | null;
  date: string;
  total: string;
  currency: Currency;
  accountId: string;
  source: TransactionSource;
  createdAt: string;
  updatedAt: string;
  account?: AccountBase;
}

export type Activity =
  | {
      type: "RECEIPT";
      receipt: Receipt;
      transactions: Transaction[];
    }
  | {
      type: "TRANSACTION";
      transaction: Transaction;
    };

export interface ActivityQuery {
  accountId?: string;
  from?: string;
  to?: string;
  categoryId?: string;
  type?: TransactionType;
  source?: TransactionSource;
  search?: string;
  minAmount?: number;
  maxAmount?: number;
  onlyReceipts?: boolean;
  page?: number;
  limit?: number;
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
  receiptId: string | null;
  accountId: string;
  categoryId: string | null;
  account?: AccountBase;
  category?: Category;
  receipt?: Receipt;
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

export interface DashboardTimelinePoint {
  date: string;
  income: string;
  expense: string;
  transferIn: string;
  transferOut: string;
}

export interface DashboardSummary {
  from: string | null;
  to: string | null;
  currency: Currency;
  income: string;
  expense: string;
  openingBalance: string;
  balance: string;
  count: number;
  byCategory: DashboardByCategory[];
  timeline: DashboardTimelinePoint[];
}
