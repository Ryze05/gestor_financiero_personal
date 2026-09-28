"use client";

import { useEffect, useState, type KeyboardEvent } from "react";
import Link from "next/link";
import {
  HiAdjustmentsHorizontal,
  HiMagnifyingGlass,
  HiPencil,
  HiPlus,
  HiTrash,
} from "react-icons/hi2";
import Card from "@/components/Card";
import DatePicker from "@/components/DatePicker";
import ActionsMenu from "@/components/ActionsMenu";
import Modal from "@/components/Dialog";
import TransactionForm from "@/components/TransactionForm";
import SelectField from "@/components/Select";
import { api, ApiError } from "@/lib/api/client";
import { toApiDate } from "@/lib/utils/date";
import { formatMoney } from "@/lib/utils/money";
import type {
  Account,
  Category,
  Transaction,
  TransactionQuery,
  TransactionType,
} from "@/lib/api/types";
import styles from "./transactions.module.css";

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [total, setTotal] = useState(0);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [type, setType] = useState<TransactionType | "">("");
  const [categoryId, setCategoryId] = useState("");
  const [accountId, setAccountId] = useState("");
  const [categories, setCategories] = useState<Category[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [showMoreFilters, setShowMoreFilters] = useState(false);
  const [from, setFrom] = useState<Date>();
  const [to, setTo] = useState<Date>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [referencesLoaded, setReferencesLoaded] = useState(false);
  const [deleting, setDeleting] = useState<Transaction | null>(null);
  const [deletingBusy, setDeletingBusy] = useState(false);
  const [deletingError, setDeletingError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Transaction | null>(null);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setSearch(searchInput.trim());
    }, 450);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [searchInput]);

  function handleSearchKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      setSearch(searchInput.trim());
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function loadReferences() {
      try {
        const [categoriesRes, accountsRes] = await Promise.all([
          api.listCategories({ page: 1, limit: 100 }),
          api.listAccounts({ page: 1, limit: 100 }),
        ]);
        if (!cancelled) {
          setCategories(categoriesRes.data);
          setAccounts(
            accountsRes.data.filter((account) => !account.isArchived),
          );
          const active = accountsRes.data.filter(
            (account) => !account.isArchived,
          );
          const saved = window.localStorage.getItem("lastAccountId");
          if (
            saved !== null &&
            (saved === "" || active.some((a) => a.id === saved))
          ) {
            setAccountId(saved);
          } else {
            setAccountId(active[0]?.id ?? "");
          }
          setReferencesLoaded(true);
        }
      } catch {
        if (!cancelled) setReferencesLoaded(true);
      }
    }

    loadReferences();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadTransactions() {
      if (!referencesLoaded) return;
      setLoading(true);
      setError(null);

      const query: TransactionQuery = {
        from: toApiDate(from),
        to: toApiDate(to),
        search: search || undefined,
        type: type || undefined,
        categoryId: categoryId || undefined,
        accountId: accountId || undefined,
        page: 1,
        limit: 20,
      };

      try {
        const result = await api.listTransactions(query);

        if (!cancelled) {
          setTransactions(result.data);
          setTotal(result.total);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof ApiError
              ? err.message
              : "No se pudieron cargar los movimientos.",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadTransactions();

    return () => {
      cancelled = true;
    };
  }, [search, type, categoryId, accountId, from, to, referencesLoaded]);

  function handleAccountChange(value: string) {
    setAccountId(value);
    window.localStorage.setItem("lastAccountId", value);
  }

  function clearFilters() {
    setSearchInput("");
    setSearch("");
    setType("");
    setCategoryId("");
    setAccountId("");
    setFrom(undefined);
    setTo(undefined);
    window.localStorage.setItem("lastAccountId", "");
  }

  const hasFilters =
    Boolean(searchInput.trim()) ||
    Boolean(search.trim()) ||
    Boolean(type) ||
    Boolean(accountId) ||
    Boolean(categoryId) ||
    Boolean(from) ||
    Boolean(to);

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Finanzas</p>
          <h1>Movimientos</h1>
          <p className={styles.description}>
            Consulta y gestiona tus ingresos y gastos.
          </p>
        </div>

        <Link href="/transactions/new" className={styles.primaryButton}>
          <HiPlus />
          Nuevo movimiento
        </Link>
      </header>

      <Card>
        <div className={styles.filtersHeader}>
          <div>
            <h2>Filtros</h2>
            <p>Personaliza el listado de movimientos.</p>
          </div>

          <div className={styles.filterActions}>
            <button
              type="button"
              className={styles.clearButton}
              onClick={hasFilters ? clearFilters : undefined}
              aria-disabled={!hasFilters}
            >
              Limpiar
            </button>
            <button
              type="button"
              className={styles.filterButton}
              onClick={() => setShowMoreFilters((current) => !current)}
              aria-expanded={showMoreFilters}
            >
            <HiAdjustmentsHorizontal />
              {showMoreFilters ? "Ocultar filtros" : "Más filtros"}
            </button>
          </div>
        </div>

        <div className={styles.filters}>
          <label className={styles.searchField}>
            <span className={styles.srOnly}>Buscar movimiento</span>
            <HiMagnifyingGlass />
            <input
              type="search"
              placeholder="Buscar por concepto..."
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              onKeyDown={handleSearchKeyDown}
            />
          </label>

          <div className={styles.typeFilters} aria-label="Filtrar por tipo">
            {[
              { value: "", label: "Todos" },
              { value: "EXPENSE", label: "Gastos" },
              { value: "INCOME", label: "Ingresos" },
            ].map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() =>
                  setType(option.value as TransactionType | "")
                }
                className={
                  type === option.value ? styles.chipActive : styles.chip
                }
              >
                {option.label}
              </button>
            ))}
          </div>

          <div className={styles.accountFilter}>
            {referencesLoaded && (
              <SelectField
                value={accountId || "all"}
                onChange={(value) =>
                  handleAccountChange(value === "all" ? "" : value)
                }
                placeholder="Todas las cuentas"
                ariaLabel="Filtrar por cuenta"
                options={[
                  { value: "all", label: "Todas las cuentas" },
                  ...accounts
                    .filter((account) => !account.isArchived)
                    .map((account) => ({
                      value: account.id,
                      label: account.name,
                    })),
                ]}
              />
            )}
          </div>

          <div className={styles.dateFilters}>
            <DatePicker value={from} onChange={setFrom} placeholder="Desde" />
            <DatePicker
              value={to}
              onChange={setTo}
              placeholder="Hasta"
              disabled={!from}
              matcher={from ? { before: from } : undefined}
            />
          </div>
        </div>

        {showMoreFilters && (
          <div className={styles.moreFilters}>
            <label className={styles.categoryFilter}>
              <span>Categoría</span>
              <SelectField
                value={categoryId || "all"}
                onChange={(value) =>
                  setCategoryId(value === "all" ? "" : value)
                }
                placeholder="Todas las categorías"
                ariaLabel="Filtrar por categoría"
                options={[
                  { value: "all", label: "Todas las categorías" },
                  ...categories.map((category) => ({
                    value: category.id,
                    label: category.name,
                  })),
                ]}
              />
            </label>
          </div>
        )}
      </Card>

      <Card>
        <div className={styles.listHeader}>
          <div>
            <h2>Listado</h2>
            <p>Los movimientos aparecerán aquí.</p>
          </div>
          <span className={styles.count}>{total} movimientos</span>
        </div>

        {loading && <p className={styles.hint}>Cargando movimientos...</p>}

        {!loading && error && <p className={styles.error}>{error}</p>}

        {!loading && !error && transactions.length === 0 && (
          <div className={styles.emptyState}>
            <p>No hay movimientos para mostrar.</p>
          </div>
        )}

        {!loading && !error && transactions.length > 0 && (
          <div className={styles.transactionList}>
            {transactions.map((transaction) => (
              <article key={transaction.id} className={styles.transactionRow}>
                <div className={styles.transactionInfo}>
                  <strong>{transaction.concept}</strong>
                  <span>
                    {transaction.date.slice(0, 10)} ·{" "}
                    {transaction.account?.name ?? "—"}{" "}
                    ·{" "}
                    {transaction.transferId
                      ? "Transferencia"
                      : transaction.category?.name ?? "Sin categoría"}
                  </span>
                </div>
                <div className={styles.transactionActions}>
                  <span
                    className={
                      transaction.type === "EXPENSE"
                        ? styles.expenseAmount
                        : styles.incomeAmount
                    }
                  >
                    {transaction.type === "EXPENSE" ? "-" : "+"}
                    {formatMoney(transaction.amount, transaction.currency)}
                  </span>
                  {transaction.exchangeRate !== "1" && (
                    <span className={styles.converted}>
                      →{" "}
                      {formatMoney(
                        transaction.accountAmount,
                        transaction.account?.currency ?? transaction.currency,
                      )}{" "}
                      @ {transaction.exchangeRate}
                    </span>
                  )}
                  <ActionsMenu
                    disabled={Boolean(transaction.transferId)}
                    items={
                      transaction.transferId
                        ? []
                        : [
                            {
                              label: "Editar",
                              icon: <HiPencil />,
                              onSelect: () => setEditing(transaction),
                            },
                            {
                              label: "Eliminar",
                              icon: <HiTrash />,
                              onSelect: () => setDeleting(transaction),
                              danger: true,
                            },
                          ]
                    }
                  />
                </div>
              </article>
            ))}
          </div>
        )}
      </Card>

      <Modal
        title="Editar movimiento"
        open={editing !== null}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
      >
        {editing && (
          <TransactionForm
            accounts={accounts}
            categories={categories.filter((category) => !category.isArchived)}
            submitLabel="Guardar cambios"
            initial={{
              type: editing.type,
              amount: editing.amount,
              concept: editing.concept,
              date: new Date(editing.date),
              accountId: editing.accountId,
              categoryId: editing.categoryId ?? "",
              notes: editing.notes ?? "",
              currency: editing.currency,
            }}
            onSubmit={async (input) => {
              await api.updateTransaction(editing.id, input);
              setEditing(null);
              const result = await api.listTransactions({
                from: toApiDate(from),
                to: toApiDate(to),
                search: search || undefined,
                type: type || undefined,
                categoryId: categoryId || undefined,
                page: 1,
                limit: 20,
              });
              setTransactions(result.data);
              setTotal(result.total);
            }}
          />
        )}
      </Modal>

      <Modal
        title="Eliminar movimiento"
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDeleting(null);
            setDeletingError(null);
          }
        }}
      >
        <p className={styles.confirmText}>
          ¿Seguro que quieres eliminar “{deleting?.concept}”? No se puede
          deshacer.
        </p>
        {deletingError && <p className={styles.error}>{deletingError}</p>}
        <div className={styles.confirmActions}>
          <button
            type="button"
            className={styles.secondaryButton}
            onClick={() => setDeleting(null)}
          >
            Cancelar
          </button>
          <button
            type="button"
            className={styles.dangerButton}
            aria-disabled={deletingBusy}
            onClick={async () => {
              if (!deleting || deletingBusy) return;
              setDeletingBusy(true);
              setDeletingError(null);
              try {
                await api.deleteTransaction(deleting.id);
                setDeleting(null);
                const result = await api.listTransactions({
                  from: toApiDate(from),
                  to: toApiDate(to),
                  search: search || undefined,
                  type: type || undefined,
                  categoryId: categoryId || undefined,
                  page: 1,
                  limit: 20,
                });
                setTransactions(result.data);
                setTotal(result.total);
              } catch (err) {
                setDeletingError(
                  err instanceof ApiError
                    ? err.message
                    : "No se pudo eliminar.",
                );
              } finally {
                setDeletingBusy(false);
              }
            }}
          >
            {deletingBusy ? "Eliminando..." : "Eliminar"}
          </button>
        </div>
      </Modal>
    </div>
  );
}
