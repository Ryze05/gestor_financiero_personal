"use client";

import { useEffect, useState, type FormEvent } from "react";
import { HiPlus } from "react-icons/hi2";
import Card from "@/components/Card";
import Modal from "@/components/Dialog";
import SelectField from "@/components/Select";
import { api, ApiError } from "@/lib/api/client";
import { formatMoney } from "@/lib/utils/money";
import type { Account, Currency } from "@/lib/api/types";
import styles from "./accounts.module.css";

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [name, setName] = useState("");
  const [currency, setCurrency] = useState<Currency>("EUR");
  const [initialBalance, setInitialBalance] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await api.listAccounts();
        if (!cancelled) setAccounts(res.data);
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof ApiError
              ? err.message
              : "No se pudieron cargar las cuentas.",
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

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (submitting) return;

    const trimmedName = name.trim();
    if (!trimmedName) return setError("Introduce un nombre.");
    if (trimmedName.length > 80) {
      return setError("El nombre no puede superar 80 caracteres.");
    }

    const balance = initialBalance.trim() === "" ? 0 : Number(initialBalance);
    if (Number.isNaN(balance)) {
      return setError("El saldo inicial no es válido.");
    }

    setSubmitting(true);
    setError(null);
    try {
      await api.createAccount({
        name: trimmedName,
        currency,
        initialBalance: balance,
      });
      setName("");
      setInitialBalance("");
      setCurrency("EUR");
      const res = await api.listAccounts();
      setAccounts(res.data);
      setOpen(false);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "No se pudo crear la cuenta.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Finanzas</p>
          <h1>Cuentas</h1>
          <p className={styles.description}>Consulta tus cuentas y saldos.</p>
        </div>

        <Modal
          title="Nueva cuenta"
          open={open}
          onOpenChange={setOpen}
          trigger={
            <button type="button" className={styles.primaryButton}>
              <HiPlus />
              Nueva cuenta
            </button>
          }
        >
          <form className={styles.form} onSubmit={handleSubmit}>
            <div className={styles.fieldRow}>
              <label className={styles.field}>
                <span className={styles.label}>Nombre</span>
                <input
                  type="text"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                />
              </label>

              <div className={styles.field}>
                <span className={styles.label}>Moneda</span>
                <SelectField
                  value={currency}
                  onChange={(value) => setCurrency(value as Currency)}
                  ariaLabel="Moneda"
                  options={[
                    { value: "EUR", label: "EUR" },
                    { value: "USD", label: "USD" },
                  ]}
                />
              </div>
            </div>

            <label className={styles.field}>
              <span className={styles.label}>Saldo inicial</span>
              <input
                type="number"
                inputMode="decimal"
                step="0.01"
                value={initialBalance}
                onChange={(event) => setInitialBalance(event.target.value)}
              />
            </label>

            {error && <p className={styles.error}>{error}</p>}

            <button
              type="submit"
              className={styles.primaryButton}
              aria-disabled={submitting}
            >
              {submitting ? "Creando..." : "Crear cuenta"}
            </button>
          </form>
        </Modal>
      </header>

      <Card>
        <div className={styles.listHeader}>
          <h2>Cuentas</h2>
          <span className={styles.count}>{accounts.length}</span>
        </div>

        {loading && <p className={styles.hint}>Cargando...</p>}
        {!loading && error && <p className={styles.error}>{error}</p>}
        {!loading && !error && accounts.length === 0 && (
          <p className={styles.hint}>No hay cuentas todavía.</p>
        )}
        {!loading && !error && accounts.length > 0 && (
          <ul className={styles.list}>
            {accounts.map((account) => (
              <li key={account.id} className={styles.row}>
                <div className={styles.rowInfo}>
                  <strong>{account.name}</strong>
                  <span>{account.currency}</span>
                </div>
                <span className={styles.balance}>
                  {formatMoney(account.currentBalance, account.currency)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}