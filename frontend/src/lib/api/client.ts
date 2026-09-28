import type {
  Account,
  Category,
  CreateTransactionInput,
  DashboardSummary,
  Paginated,
  Transaction,
  TransactionQuery,
  UpdateTransactionInput,
} from "./types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api/v1";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

function params(values: object): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (
      (typeof value === "string" || typeof value === "number") &&
      value !== ""
    ) {
      search.set(key, String(value));
    }
  }
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      headers: { "Content-Type": "application/json", ...init?.headers },
      ...init,
    });
  } catch {
    throw new ApiError("No se pudo conectar con el servidor.", 0);
  }
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    const message =
      (body as { message?: string })?.message ?? `Error ${res.status}`;
    throw new ApiError(message, res.status, body);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  getDashboard: (query?: {
    from?: string;
    to?: string;
    currency?: string;
  }) => request<DashboardSummary>(`/dashboard${params(query ?? {})}`),

  //----------------------------------------------------------------------------

  listTransactions: (query?: TransactionQuery) =>
    request<Paginated<Transaction>>(`/transactions${params(query ?? {})}`),

  getTransaction: (id: string) => request<Transaction>(`/transactions/${id}`),

  createTransaction: (body: CreateTransactionInput) =>
    request<Transaction>("/transactions", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  updateTransaction: (id: string, body: UpdateTransactionInput) =>
    request<Transaction>(`/transactions/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),

  deleteTransaction: (id: string) =>
    request<void>(`/transactions/${id}`, { method: "DELETE" }),

  //----------------------------------------------------------------------------  

  listAccounts: (query?: { page?: number; limit?: number }) =>
    request<Paginated<Account>>(`/accounts${params(query ?? {})}`),

  createAccount: (body: unknown) =>
    request<Account>("/accounts", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  deleteAccount: (id: string) =>
    request<void>(`/accounts/${id}`, { method: "DELETE" }),

  restoreAccount: (id: string) =>
    request<Account>(`/accounts/${id}/restore`, { method: "PATCH" }),

  //----------------------------------------------------------------------------  
    
  listCategories: (query?: { page?: number; limit?: number }) =>
    request<Paginated<Category>>(`/categories${params(query ?? {})}`),

  createCategory: (body: unknown) =>
    request<Category>("/categories", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  deleteCategory: (id: string) =>
    request<void>(`/categories/${id}`, { method: "DELETE" }),

  restoreCategory: (id: string) =>
    request<Category>(`/categories/${id}/restore`, { method: "PATCH" }),
};
