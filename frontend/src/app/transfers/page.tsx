"use client";

import { useEffect, useState, type FormEvent } from "react";
import { HiArrowsRightLeft, HiTrash } from "react-icons/hi2";
import Card from "@/components/Card";
import Modal from "@/components/Dialog";
import SelectField from "@/components/Select";
import DatePicker from "@/components/DatePicker";
import ActionsMenu from "@/components/ActionsMenu";
import { api, ApiError } from "@/lib/api/client";
import { formatMoney } from "@/lib/utils/money";
import { toApiDate } from "@/lib/utils/date";
import type { Account, Currency, Transfer } from "@/lib/api/types";
import styles from "./transfers.module.css";

export default function TransfersPage() {
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [transfersRes, accountsRes] = await Promise.all([
          api.listTransfers({ page: 1, limit: 100 }),
          api.listAccounts({ page: 1, limit: 100 }),
        ]);
        if (!cancelled) {
          setTransfers(transfersRes.data);
          setAccounts(accountsRes.data);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof ApiError
              ? err.message
              : "No se pudieron cargar las transferencias.",
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

  const accountName = (id: string) =>
    accounts.find((account) => account.id === id)?.name ?? "—";

  const activeAccounts = accounts.filter((account) => !account.isArchived);

  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [sourceAccountId, setSourceAccountId] = useState("");
  const [destinationAccountId, setDestinationAccountId] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [concept, setConcept] = useState("");

  const [deleting, setDeleting] = useState<Transfer | null>(null);
  const [deletingBusy, setDeletingBusy] = useState(false);
  const [deletingError, setDeletingError] = useState<string | null>(null);

  const sourceAccount = accounts.find((a) => a.id === sourceAccountId);
  const currency: Currency = sourceAccount?.currency ?? "EUR";

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (submitting) return;

    if (!sourceAccountId) return setError("Selecciona la cuenta de origen.");
    if (!destinationAccountId) {
      return setError("Selecciona la cuenta de destino.");
    }
    if (sourceAccountId === destinationAccountId) {
      return setError("Las cuentas deben ser distintas.");
    }
    const destination = accounts.find((a) => a.id === destinationAccountId);
    if (sourceAccount?.currency !== destination?.currency) {
      return setError("La conversión de divisa aún no está disponible.");
    }
    const value = Number(amount);
    if (!value || value <= 0) return setError("Introduce un importe válido.");
    if (!date) return setError("Selecciona una fecha.");

    setSubmitting(true);
    setError(null);
    try {
      await api.createTransfer({
        amount: value,
        date: toApiDate(date)!,
        sourceAccountId,
        destinationAccountId,
        concept: concept.trim() || undefined,
      });
      const res = await api.listTransfers({ page: 1, limit: 100 });
      setTransfers(res.data);
      setOpen(false);
      setSourceAccountId("");
      setDestinationAccountId("");
      setAmount("");
      setConcept("");
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "No se pudo crear la transferencia.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!deleting || deletingBusy) return;
    setDeletingBusy(true);
    setDeletingError(null);
    try {
      await api.deleteTransfer(deleting.id);
      setDeleting(null);
      const res = await api.listTransfers({ page: 1, limit: 100 });
      setTransfers(res.data);
    } catch (err) {
      setDeletingError(
        err instanceof ApiError ? err.message : "No se pudo eliminar.",
      );
    } finally {
      setDeletingBusy(false);
    }
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Finanzas</p>
          <h1>Transferencias</h1>
          <p className={styles.description}>Mueve dinero entre tus cuentas.</p>
        </div>

        <Modal
          title="Nueva transferencia"
          open={open}
          onOpenChange={setOpen}
          trigger={
            <button type="button" className={styles.primaryButton}>
              <HiArrowsRightLeft />
              Nueva transferencia
            </button>
          }
        >
          <form className={styles.form} onSubmit={handleSubmit}>
            <div className={styles.field}>
              <span className={styles.label}>Cuenta de origen</span>
              <SelectField
                value={sourceAccountId}
                onChange={setSourceAccountId}
                placeholder="Selecciona la cuenta"
                ariaLabel="Cuenta de origen"
                options={activeAccounts.map((account) => ({
                  value: account.id,
                  label: `${account.name} (${account.currency})`,
                }))}
              />
            </div>

            <div className={styles.field}>
              <span className={styles.label}>Cuenta de destino</span>
              <SelectField
                value={destinationAccountId}
                onChange={setDestinationAccountId}
                placeholder="Selecciona la cuenta"
                ariaLabel="Cuenta de destino"
                options={activeAccounts.map((account) => ({
                  value: account.id,
                  label: `${account.name} (${account.currency})`,
                }))}
              />
            </div>

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
              <span className={styles.label}>Fecha</span>
              <DatePicker value={date} onChange={setDate} />
            </div>

            <label className={styles.field}>
              <span className={styles.label}>Concepto (opcional)</span>
              <input
                type="text"
                value={concept}
                onChange={(event) => setConcept(event.target.value)}
              />
            </label>

            {error && <p className={styles.error}>{error}</p>}

            <button
              type="submit"
              className={styles.primaryButton}
              aria-disabled={submitting}
            >
              {submitting ? "Creando..." : "Crear transferencia"}
            </button>
          </form>
        </Modal>
      </header>

      <Card>
        <div className={styles.listHeader}>
          <h2>Transferencias</h2>
          <span className={styles.count}>{transfers.length}</span>
        </div>

        {loading && <p className={styles.hint}>Cargando...</p>}
        {!loading && error && <p className={styles.error}>{error}</p>}
        {!loading && !error && transfers.length === 0 && (
          <p className={styles.hint}>No hay transferencias todavía.</p>
        )}
        {!loading && !error && transfers.length > 0 && (
          <ul className={styles.list}>
            {transfers.map((transfer) => (
              <li key={transfer.id} className={styles.row}>
                <div className={styles.rowInfo}>
                  <strong>{transfer.concept ?? "Transferencia"}</strong>
                  <span>
                    {transfer.date.slice(0, 10)} ·{" "}
                    {accountName(transfer.sourceAccountId)} →{" "}
                    {accountName(transfer.destinationAccountId)}
                  </span>
                </div>
                <div className={styles.rowActions}>
                  <span className={styles.amount}>
                    {formatMoney(transfer.amount, transfer.sourceCurrency)}
                  </span>
                  <ActionsMenu
                    ariaLabel={`Acciones de ${transfer.concept ?? "transferencia"}`}
                    items={[
                      {
                        label: "Eliminar",
                        icon: <HiTrash />,
                        onSelect: () => setDeleting(transfer),
                        danger: true,
                      },
                    ]}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Modal
        title="Eliminar transferencia"
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDeleting(null);
            setDeletingError(null);
          }
        }}
      >
        <p className={styles.confirmText}>
          ¿Seguro que quieres eliminar la transferencia de{" "}
          {deleting ? formatMoney(deleting.amount, deleting.sourceCurrency) : ""}? No
          se puede deshacer.
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
            onClick={handleDelete}
          >
            {deletingBusy ? "Eliminando..." : "Eliminar"}
          </button>
        </div>
      </Modal>
    </div>
  );
}