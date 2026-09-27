"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import DatePicker from "@/components/DatePicker";
import SelectField from "@/components/Select";
import { ApiError } from "@/lib/api/client";
import { toApiDate } from "@/lib/utils/date";
import type {
  Account,
  Category,
  CreateTransactionInput,
  Currency,
  TransactionType,
} from "@/lib/api/types";
import styles from "./transaction-form.module.css";

export interface TransactionFormInitial {
  type?: TransactionType;
  amount?: string;
  concept?: string;
  date?: Date;
  accountId?: string;
  categoryId?: string;
  notes?: string;
}

export default function TransactionForm({
  accounts,
  categories,
  initial,
  submitLabel = "Guardar",
  onSubmit,
}: {
  accounts: Account[];
  categories: Category[];
  initial?: TransactionFormInitial;
  submitLabel?: string;
  onSubmit: (input: CreateTransactionInput) => Promise<void>;
}) {
  const [type, setType] = useState<TransactionType>(initial?.type ?? "EXPENSE");
  const [amount, setAmount] = useState(initial?.amount ?? "");
  const [concept, setConcept] = useState(initial?.concept ?? "");
  const [date, setDate] = useState<Date | undefined>(
    initial?.date ?? new Date(),
  );
  const [accountId, setAccountId] = useState(initial?.accountId ?? "");
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      await onSubmit({
        type,
        amount: value,
        currency,
        concept: concept.trim(),
        date: toApiDate(date)!,
        notes: notes.trim() || undefined,
        categoryId,
        accountId,
      });
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
        {submitting ? "Guardando..." : submitLabel}
      </button>
    </form>
  );
}