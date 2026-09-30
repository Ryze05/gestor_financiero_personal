"use client";

import { useState, type FormEvent } from "react";
import DatePicker from "@/components/DatePicker";
import SelectField from "@/components/Select";
import ConfirmDialog from "@/components/ConfirmDialog";
import Spinner from "@/components/Spinner";
import { HiPlus, HiTrash } from "react-icons/hi2";
import { api, ApiError } from "@/lib/api/client";
import { toApiDate } from "@/lib/utils/date";
import { formatMoney } from "@/lib/utils/money";
import type {
  Account,
  Category,
  CreateReceiptInput,
  Currency,
  ReceiptLineInput,
} from "@/lib/api/types";
import styles from "./receipt-form.module.css";

interface LineState {
  amount: string;
  concept: string;
  categoryId: string;
}

export interface ReceiptFormInitial {
  merchant?: string;
  date?: Date;
  accountId?: string;
  currency?: Currency;
  total?: string;
  autoTotal?: boolean;
  lines?: ReceiptLineInput[];
}

export default function ReceiptForm({
  accounts,
  categories,
  initial,
  submitLabel = "Guardar ticket",
  onSubmit,
}: {
  accounts: Account[];
  categories: Category[];
  initial?: ReceiptFormInitial;
  submitLabel?: string;
  onSubmit: (input: CreateReceiptInput) => Promise<void>;
}) {
  const [merchant, setMerchant] = useState(initial?.merchant ?? "");
  const [date, setDate] = useState<Date | undefined>(
    initial?.date ?? new Date(),
  );
  const [accountId, setAccountId] = useState(initial?.accountId ?? "");
  const [currency, setCurrency] = useState<Currency>(
    initial?.currency ?? "EUR",
  );
  const [total, setTotal] = useState(initial?.total ?? "");
  const [autoTotal, setAutoTotal] = useState(initial?.autoTotal ?? true);
  const [lines, setLines] = useState<LineState[]>(
    initial?.lines?.length
      ? initial.lines.map((line) => ({
          amount: line.amount ? String(line.amount) : "",
          concept: line.concept,
          categoryId: line.categoryId,
        }))
      : [emptyLine()],
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fundsWarning, setFundsWarning] = useState<{
    projected: number;
    currency: Currency;
  } | null>(null);

  const expenseCategories = categories.filter(
    (category) => category.type === "BOTH" || category.type === "EXPENSE",
  );

  const selectedAccount = accounts.find((account) => account.id === accountId);

  function emptyLine(): LineState {
    return { amount: "", concept: "", categoryId: "" };
  }

  const sum = lines.reduce((acc, line) => acc + (Number(line.amount) || 0), 0);

  function updateLine(index: number, patch: Partial<LineState>) {
    setLines((current) =>
      current.map((line, i) => (i === index ? { ...line, ...patch } : line)),
    );
  }

  function buildPayload() {
    const validLines = lines.filter(
      (line) =>
        line.concept.trim() && Number(line.amount) > 0 && line.categoryId,
    );
    const totalValue = autoTotal ? sum : Number(total);
    return { validLines, totalValue };
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (submitting) return;

    if (!merchant.trim()) return setError("Introduce el comercio.");
    if (!date) return setError("Selecciona una fecha.");
    if (!accountId) return setError("Selecciona una cuenta.");

    const { validLines, totalValue } = buildPayload();
    if (validLines.length === 0)
      return setError(
        "Añade al menos una línea con concepto, importe y categoría.",
      );
    if (!totalValue || totalValue <= 0)
      return setError("El total debe ser mayor que cero.");

    setSubmitting(true);
    setError(null);

    const selectedAccount = accounts.find((account) => account.id === accountId);
    if (selectedAccount) {
      let accountTotal = totalValue;
      if (currency !== selectedAccount.currency) {
        try {
          const rate = await api.getRate(currency, selectedAccount.currency);
          accountTotal = Number(rate.rate) * totalValue;
        } catch {
          await performSubmit(validLines, totalValue);
          return;
        }
      }
      const projected = Number(selectedAccount.currentBalance) - accountTotal;
      if (projected < 0) {
        setSubmitting(false);
        setFundsWarning({ projected, currency: selectedAccount.currency });
        return;
      }
    }

    await performSubmit(validLines, totalValue);
  }

  async function performSubmit(
    validLines: { amount: string; concept: string; categoryId: string }[],
    totalValue: number,
  ) {
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit({
        externalId: `web-${crypto.randomUUID()}`,
        merchant: merchant.trim() || undefined,
        date: toApiDate(date)!,
        total: totalValue,
        currency,
        accountId,
        source: "WEB",
        lines: validLines.map((line) => ({
          amount: Number(line.amount),
          concept: line.concept.trim(),
          categoryId: line.categoryId,
        })),
      });
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "No se pudo guardar el ticket.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <label className={styles.field}>
        <span className={styles.label}>Comercio</span>
        <input
          type="text"
          value={merchant}
          onChange={(event) => setMerchant(event.target.value)}
          placeholder="Ej. Carrefour"
        />
      </label>

      <div className={styles.fieldRow}>
        <div className={styles.field}>
          <span className={styles.label}>Fecha</span>
          <DatePicker value={date} onChange={setDate} />
        </div>
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
      </div>

      <div className={styles.field}>
        <span className={styles.label}>Moneda</span>
        <div className={styles.typeFilters}>
          {(["EUR", "USD"] as Currency[]).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setCurrency(option)}
              className={currency === option ? styles.chipActive : styles.chip}
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

      <div className={styles.linesHeader}>
        <span className={styles.label}>Líneas (un item por línea)</span>
        <button
          type="button"
          className={styles.addLineButton}
          onClick={() => setLines((current) => [...current, emptyLine()])}
        >
          <HiPlus />
          Añadir línea
        </button>
      </div>

      {lines.map((line, index) => (
        <div key={index} className={styles.line}>
          <input
            className={styles.lineConcept}
            type="text"
            placeholder="Concepto (Ej. Pan)"
            value={line.concept}
            onChange={(event) =>
              updateLine(index, { concept: event.target.value })
            }
          />
          <input
            className={styles.lineAmount}
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            placeholder="0,00"
            value={line.amount}
            onChange={(event) =>
              updateLine(index, { amount: event.target.value })
            }
          />
          <SelectField
            value={line.categoryId}
            onChange={(value) => updateLine(index, { categoryId: value })}
            placeholder="Categoría"
            ariaLabel={`Categoría línea ${index + 1}`}
            options={expenseCategories.map((category) => ({
              value: category.id,
              label: category.name,
            }))}
          />
          <button
            type="button"
            className={styles.removeLineButton}
            aria-label={`Eliminar línea ${index + 1}`}
            onClick={() =>
              setLines((current) => current.filter((_, i) => i !== index))
            }
            aria-disabled={lines.length === 1}
          >
            <HiTrash />
          </button>
        </div>
      ))}

      <div className={styles.totalRow}>
        <div className={styles.field}>
          <span className={styles.label}>Total</span>
          <div className={styles.typeFilters}>
            <button
              type="button"
              className={autoTotal ? styles.chipActive : styles.chip}
              onClick={() => setAutoTotal(true)}
            >
              Automático
            </button>
            <button
              type="button"
              className={!autoTotal ? styles.chipActive : styles.chip}
              onClick={() => setAutoTotal(false)}
            >
              Manual
            </button>
          </div>
        </div>
        <label className={styles.field}>
          <span className={styles.label}>Total ({currency})</span>
          <input
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            value={autoTotal ? (sum || "") : total}
            onChange={(event) => setTotal(event.target.value)}
            disabled={autoTotal}
            aria-disabled={autoTotal}
          />
        </label>
      </div>

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
          const { validLines, totalValue } = buildPayload();
          void performSubmit(validLines, totalValue);
        }}
      />
    </form>
  );
}