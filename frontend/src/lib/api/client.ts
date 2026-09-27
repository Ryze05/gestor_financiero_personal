import type {
  Account,
  Category,
  DashboardSummary,
  Paginated,
  Transaction,
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

function params(values: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined && value !== "") search.set(key, String(value));
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

  listTransactions: (
    query?: Record<string, string | number | undefined>,
  ) => request<Paginated<Transaction>>(`/transactions${params(query ?? {})}`),

  getTransaction: (id: string) => request<Transaction>(`/transactions/${id}`),

  createTransaction: (body: unknown) =>
    request<Transaction>("/transactions", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  //----------------------------------------------------------------------------  

  listAccounts: () => request<Paginated<Account>>("/accounts"),

  createAccount: (body: unknown) =>
    request<Account>("/accounts", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  //----------------------------------------------------------------------------  
    
  listCategories: () => request<Paginated<Category>>("/categories"),

  createCategory: (body: unknown) =>
    request<Category>("/categories", {
      method: "POST",
      body: JSON.stringify(body),
    }),
};