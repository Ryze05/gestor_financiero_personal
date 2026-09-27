"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { HiArrowLeft } from "react-icons/hi2";
import Card from "@/components/Card";
import DatePicker from "@/components/DatePicker";
import SelectField from "@/components/Select";
import { api, ApiError } from "@/lib/api/client";
import { toApiDate } from "@/lib/utils/date";
import type {
  Account,
  Category,
  Currency,
  TransactionType,
} from "@/lib/api/types";
import styles from "./new-transaction.module.css";

export default function NewTransactionPage() {
  const router = useRouter();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [type, setType] = useState<TransactionType>("EXPENSE");
  const [amount, setAmount] = useState("");
  const [concept, setConcept] = useState("");
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [accountId, setAccountId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [notes, setNotes] = useState("");
  const notesRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = notesRef.current;
    if (!el) return;
    const maxHeight = 240;
    el.style.height = "auto";
    const nextHeight = Math.min(el.scrollHeight, maxHeight);
    el.style.height = `${nextHeight}px`;
    el.style.overflowY = el.scrollHeight > maxHeight ? "auto" : "hidden";
  }, [notes]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [accountsRes, categoriesRes] = await Promise.all([
          api.listAccounts(),
          api.listCategories(),
        ]);
        if (!cancelled) {
          setAccounts(accountsRes.data);
          setCategories(categoriesRes.data);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof ApiError
              ? err.message
              : "No se pudieron cargar los datos.",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, []);

  const compatibleCategories = categories.filter(
    (category) => category.type === "BOTH" || category.type === type,
  );

  const selectedAccount = accounts.find((account) => account.id === accountId);
  const currency: Currency = selectedAccount?.currency ?? "EUR";

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (submitting) return;

    if (!date) return setError("Selecciona una fecha.");
    if (!accountId) return setError("Selecciona una cuenta.");
    if (!categoryId) return setError("Selecciona una categoría.");
    const value = Number(amount);
    if (!value || value <= 0) return setError("Introduce un importe válido.");
    if (!concept.trim()) return setError("Introduce un concepto.");

    setSubmitting(true);
    setError(null);
    try {
      await api.createTransaction({
        type,
        amount: value,
        currency,
        concept: concept.trim(),
        date: toApiDate(date)!,
        notes: notes.trim() || undefined,
        categoryId,
        accountId,
      });
      router.push("/transactions");
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "No se pudo guardar el movimiento.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className={styles.page}>
      <Link href="/transactions" className={styles.back}>
        <HiArrowLeft />
        Volver a movimientos
      </Link>

      <h1>Nuevo movimiento</h1>

      {loading && <p className={styles.hint}>Cargando datos...</p>}

      {!loading && (
        <Card>
          <form className={styles.form} onSubmit={handleSubmit}>
            <fieldset className={styles.field}>
              <span className={styles.label}>Tipo</span>
              <div className={styles.typeFilters}>
                {[
                  { value: "EXPENSE", label: "Gasto" },
                  { value: "INCOME", label: "Ingreso" },
                ].map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => {
                      setType(option.value as TransactionType);
                      setCategoryId("");
                    }}
                    className={
                      type === option.value ? styles.chipActive : styles.chip
                    }
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </fieldset>

            <label className={styles.field}>
              <span className={styles.label}>Importe</span>
              <div className={styles.amountField}>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                />
                <span className={styles.amountCurrency}>{currency}</span>
              </div>
            </label>

            <label className={styles.field}>
              <span className={styles.label}>Concepto</span>
              <input
                type="text"
                value={concept}
                onChange={(event) => setConcept(event.target.value)}
              />
            </label>

            <div className={styles.field}>
              <span className={styles.label}>Fecha</span>
              <DatePicker value={date} onChange={setDate} />
            </div>

            <div className={styles.fieldRow}>
              <div className={styles.field}>
                <span className={styles.label}>Cuenta</span>
                <SelectField
                  value={accountId}
                  onChange={setAccountId}
                  placeholder="Selecciona una cuenta"
                  ariaLabel="Cuenta"
                  options={accounts.map((account) => ({
                    value: account.id,
                    label: `${account.name} (${account.currency})`,
                  }))}
                />
              </div>

              <div className={styles.field}>
                <span className={styles.label}>Categoría</span>
                <SelectField
                  value={categoryId}
                  onChange={setCategoryId}
                  placeholder="Selecciona una categoría"
                  ariaLabel="Categoría"
                  options={compatibleCategories.map((category) => ({
                    value: category.id,
                    label: category.name,
                  }))}
                />
              </div>
            </div>

            <label className={styles.field}>
              <span className={styles.label}>Notas (opcional)</span>
              <textarea
                ref={notesRef}
                rows={1}
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
              />
            </label>

            {error && <p className={styles.error}>{error}</p>}

            <button
              type="submit"
              className={styles.primaryButton}
              aria-disabled={submitting}
            >
              {submitting ? "Guardando..." : "Guardar movimiento"}
            </button>
          </form>
        </Card>
      )}
    </div>
  );
}