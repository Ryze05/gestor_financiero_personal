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
  const [categories, setCategories] = useState<Category[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [showMoreFilters, setShowMoreFilters] = useState(false);
  const [from, setFrom] = useState<Date>();
  const [to, setTo] = useState<Date>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
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
          setAccounts(accountsRes.data);
        }
      } catch {
        // The transaction list remains usable if references fail to load.
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
      setLoading(true);
      setError(null);

      const query: TransactionQuery = {
        from: toApiDate(from),
        to: toApiDate(to),
        search: search || undefined,
        type: type || undefined,
        categoryId: categoryId || undefined,
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
  }, [search, type, categoryId, from, to]);

  function clearFilters() {
    setSearchInput("");
    setSearch("");
    setType("");
    setCategoryId("");
    setFrom(undefined);
    setTo(undefined);
  }

  const hasFilters =
    Boolean(searchInput.trim()) ||
    Boolean(search.trim()) ||
    Boolean(type) ||
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
              <select
                value={categoryId}
                onChange={(event) => setCategoryId(event.target.value)}
              >
                <option value="">Todas las categorías</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
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
                    {accounts.find((a) => a.id === transaction.accountId)?.name ??
                      "—"}{" "}
                    ·{" "}
                    {transaction.categoryId
                      ? (categories.find((c) => c.id === transaction.categoryId)
                          ?.name ?? "—")
                      : "Sin categoría"}
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
                  <ActionsMenu
                    items={[
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
                    ]}
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
            categories={categories}
            submitLabel="Guardar cambios"
            initial={{
              type: editing.type,
              amount: editing.amount,
              concept: editing.concept,
              date: new Date(editing.date),
              accountId: editing.accountId,
              categoryId: editing.categoryId ?? "",
              notes: editing.notes ?? "",
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
