"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import DatePicker from "@/components/DatePicker";
import SelectField from "@/components/Select";
import ConfirmDialog from "@/components/ConfirmDialog";
import Spinner from "@/components/Spinner";
import { api, ApiError } from "@/lib/api/client";
import { toApiDate } from "@/lib/utils/date";
import { formatMoney } from "@/lib/utils/money";
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
  currency?: Currency;
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
  const [currency, setCurrency] = useState<Currency>(
    initial?.currency ?? "EUR",
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fundsWarning, setFundsWarning] = useState<{
    projected: number;
    currency: Currency;
  } | null>(null);

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

    if (type === "EXPENSE" && selectedAccount) {
      let accountAmount = value;
      if (currency !== selectedAccount.currency) {
        try {
          const rate = await api.getRate(currency, selectedAccount.currency);
          accountAmount = Number(rate.rate) * value;
        } catch {
          await performSubmit();
          return;
        }
      }
      const projected = Number(selectedAccount.currentBalance) - accountAmount;
      if (projected < 0) {
        setSubmitting(false);
        setFundsWarning({
          projected,
          currency: selectedAccount.currency,
        });
        return;
      }
    }

    await performSubmit();
  }

  async function performSubmit() {
    const value = Number(amount);
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

      <div className={styles.field}>
        <span className={styles.label}>Moneda</span>
        <div className={styles.typeFilters}>
          {(["EUR", "USD"] as Currency[]).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setCurrency(option)}
              className={
                currency === option ? styles.chipActive : styles.chip
              }
            >
              {option}
            </button>
          ))}
        </div>
      </div>

      {selectedAccount && currency !== selectedAccount.currency && (
        <p className={styles.hint}>
          La moneda es distinta a la de la cuenta: se convertirá al guardar.
        </p>
      )}

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
            onChange={(value) => {
              setAccountId(value);
              const next = accounts.find((account) => account.id === value);
              setCurrency(next?.currency ?? "EUR");
            }}
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
        {submitting && <Spinner />}
        {submitting ? "Guardando..." : submitLabel}
      </button>

      <ConfirmDialog
        open={fundsWarning !== null}
        title="Saldo insuficiente"
        message={`La cuenta quedará en ${formatMoney(
          String(fundsWarning?.projected ?? 0),
          fundsWarning?.currency ?? "EUR",
        )}. ¿Continuar?`}
        onCancel={() => setFundsWarning(null)}
        onConfirm={() => {
          setFundsWarning(null);
          performSubmit();
        }}
      />
    </form>
  );
}