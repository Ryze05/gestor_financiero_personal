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
import SkeletonList from "@/components/SkeletonList";
import SkeletonSelect from "@/components/SkeletonSelect";
import TicketRow from "@/components/TicketRow";
import { api, ApiError } from "@/lib/api/client";
import { toApiDate } from "@/lib/utils/date";
import { formatMoney } from "@/lib/utils/money";
import type {
  Account,
  Activity,
  ActivityQuery,
  Category,
  Transaction,
  TransactionSource,
  TransactionType,
} from "@/lib/api/types";
import styles from "./transactions.module.css";

export default function TransactionsPage() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [total, setTotal] = useState(0);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [type, setType] = useState<TransactionType | "">("");
  const [source, setSource] = useState<TransactionSource | "">("");
  const [categoryId, setCategoryId] = useState("");
  const [accountId, setAccountId] = useState("");
  const [minAmount, setMinAmount] = useState("");
  const [maxAmount, setMaxAmount] = useState("");
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

      const query: ActivityQuery = buildQuery();

      try {
        const result = await api.listActivities(query);

        if (!cancelled) {
          setActivities(result.data);
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, type, source, categoryId, accountId, minAmount, maxAmount, from, to, referencesLoaded]);

  function handleAccountChange(value: string) {
    setAccountId(value);
    window.localStorage.setItem("lastAccountId", value);
  }

  function buildQuery(): ActivityQuery {
    return {
      from: toApiDate(from),
      to: toApiDate(to),
      search: search || undefined,
      type: type || undefined,
      source: source || undefined,
      categoryId: categoryId || undefined,
      accountId: accountId || undefined,
      minAmount: Number(minAmount) > 0 ? Number(minAmount) : undefined,
      maxAmount: Number(maxAmount) > 0 ? Number(maxAmount) : undefined,
      page: 1,
      limit: 20,
    };
  }

  function clearFilters() {
    setSearchInput("");
    setSearch("");
    setType("");
    setSource("");
    setCategoryId("");
    setAccountId("");
    setMinAmount("");
    setMaxAmount("");
    setFrom(undefined);
    setTo(undefined);
    window.localStorage.setItem("lastAccountId", "");
  }

  const hasFilters =
    Boolean(searchInput.trim()) ||
    Boolean(search.trim()) ||
    Boolean(type) ||
    Boolean(source) ||
    Boolean(accountId) ||
    Boolean(categoryId) ||
    Boolean(minAmount) ||
    Boolean(maxAmount) ||
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
            {referencesLoaded ? (
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
            ) : (
              <SkeletonSelect />
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

            <label className={styles.sourceFilter}>
              <span>Origen</span>
              <SelectField
                value={source || "all"}
                onChange={(value) =>
                  setSource(value === "all" ? "" : (value as TransactionSource))
                }
                placeholder="Todos los orígenes"
                ariaLabel="Filtrar por origen"
                options={[
                  { value: "all", label: "Todos los orígenes" },
                  { value: "WEB", label: "Web" },
                  { value: "OPENCLAW", label: "OpenClaw" },
                ]}
              />
            </label>

            <div className={styles.amountFilters}>
              <label className={styles.amountFilter}>
                <span>Importe mínimo</span>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0"
                  value={minAmount}
                  onChange={(event) => setMinAmount(event.target.value)}
                />
              </label>
              <label className={styles.amountFilter}>
                <span>Importe máximo</span>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0"
                  value={maxAmount}
                  onChange={(event) => setMaxAmount(event.target.value)}
                />
              </label>
            </div>
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

        {loading && activities.length === 0 && <SkeletonList />}

        {!loading && error && <p className={styles.error}>{error}</p>}

        {!loading && !error && activities.length === 0 && (
          <div className={styles.emptyState}>
            <p>No hay movimientos para mostrar.</p>
          </div>
        )}

        {!error && activities.length > 0 && (
          <div className={styles.transactionList}>
            {activities.map((activity) =>
              activity.type === "RECEIPT" ? (
                <TicketRow
                  key={activity.receipt.id}
                  receipt={activity.receipt}
                  lines={activity.transactions}
                />
              ) : (
                <article
                  key={activity.transaction.id}
                  className={styles.transactionRow}
                >
                  <div className={styles.transactionInfo}>
                    <strong>{activity.transaction.concept}</strong>
                    <span>
                      {activity.transaction.date.slice(0, 10)} ·{" "}
                      {activity.transaction.account?.name ?? "—"}{" "}
                      ·{" "}
                      {activity.transaction.category?.name ?? "Sin categoría"}
                    </span>
                  </div>
                  <div className={styles.transactionActions}>
                    <span
                      className={
                        activity.transaction.type === "EXPENSE"
                          ? styles.expenseAmount
                          : styles.incomeAmount
                      }
                    >
                      {activity.transaction.type === "EXPENSE" ? "-" : "+"}
                      {formatMoney(
                        activity.transaction.amount,
                        activity.transaction.currency,
                      )}
                    </span>
                    {activity.transaction.exchangeRate !== "1" && (
                      <span className={styles.converted}>
                        →{" "}
                        {formatMoney(
                          activity.transaction.accountAmount,
                          activity.transaction.account?.currency ??
                            activity.transaction.currency,
                        )}{" "}
                        @ {activity.transaction.exchangeRate}
                      </span>
                    )}
                    <ActionsMenu
                      disabled={Boolean(activity.transaction.transferId)}
                      items={
                        activity.transaction.transferId
                          ? []
                          : [
                              {
                                label: "Editar",
                                icon: <HiPencil />,
                                onSelect: () =>
                                  setEditing(activity.transaction),
                              },
                              {
                                label: "Eliminar",
                                icon: <HiTrash />,
                                onSelect: () => setDeleting(activity.transaction),
                                danger: true,
                              },
                            ]
                      }
                    />
                  </div>
                </article>
              ),
            )}
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
              const result = await api.listActivities(buildQuery());
              setActivities(result.data);
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
                const result = await api.listActivities(buildQuery());
                setActivities(result.data);
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
