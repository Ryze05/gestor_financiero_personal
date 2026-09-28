"use client";

import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api/client";
import type { Account, DashboardSummary } from "@/lib/api/types";
import Card from "@/components/Card";
import CategoryDonut from "@/components/CategoryDonut";
import BalanceChart from "@/components/BalanceChart";
import TimelineChart from "@/components/TimelineChart";
import MonthPicker from "@/components/MonthPicker";
import SelectField from "@/components/Select";
import styles from "./dashboard.module.css";

function monthRange(value: string): { from: string; to: string } {
  const [year, month] = value.split("-").map(Number);
  const lastDay = new Date(year, month, 0).getDate();
  return {
    from: `${value}-01`,
    to: `${value}-${String(lastDay).padStart(2, "0")}`,
  };
}

const fmt = new Intl.NumberFormat("es-ES", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function money(amount: string, currency: string): string {
  const symbol = currency === "EUR" ? "€" : "$";
  return `${fmt.format(Number(amount))} ${symbol}`;
}

export default function Home() {
  const [month, setMonth] = useState(() =>
    new Date().toISOString().slice(0, 7),
  );
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [accountId, setAccountId] = useState("");
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const selectedAccount = accounts.find((a) => a.id === accountId);

  useEffect(() => {
    let cancelled = false;

    async function loadAccounts() {
      try {
        const res = await api.listAccounts({ page: 1, limit: 100 });
        const active = res.data.filter((account) => !account.isArchived);
        if (cancelled) return;
        setAccounts(active);
        const saved = window.localStorage.getItem("lastAccountId");
        if (saved && active.some((a) => a.id === saved)) {
          setAccountId(saved);
        } else if (active.length > 0) {
          setAccountId(active[0].id);
        }
      } catch {
        if (!cancelled) {
          setError("No se pudieron cargar las cuentas.");
        }
      }
    }

    loadAccounts();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!accountId) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [res, accountsRes] = await Promise.all([
          api.getDashboard({
            ...monthRange(month),
            accountId,
          }),
          api.listAccounts({ page: 1, limit: 100 }),
        ]);
        if (!cancelled) {
          setData(res);
          setAccounts(
            accountsRes.data.filter((account) => !account.isArchived),
          );
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : "Error inesperado");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [month, accountId]);

  return (
    <div className={styles.page}>
      <div className={styles.controls}>
        <MonthPicker value={month} onChange={setMonth} />
        <div className={styles.accountFilter}>
          <SelectField
            value={accountId}
            onChange={(value) => {
              setAccountId(value);
              window.localStorage.setItem("lastAccountId", value);
            }}
            placeholder="Selecciona una cuenta"
            ariaLabel="Filtrar por cuenta"
            options={accounts.map((account) => ({
              value: account.id,
              label: account.name,
            }))}
          />
        </div>
      </div>

      {loading && <p className={styles.hint}>Cargando...</p>}
      {!loading && error && <p className={styles.error}>{error}</p>}

      {!loading && !error && data && (
        <div className={styles.grid}>
          <Card className={styles.balance} title="Saldo actual">
            <span className={styles.value}>
              {selectedAccount
                ? money(selectedAccount.currentBalance, selectedAccount.currency)
                : "—"}
            </span>
          </Card>

          <Card className={styles.income} title="Ingresos">
            <span className={`${styles.value} ${styles.valuePositive}`}>
              {money(data.income, data.currency)}
            </span>
          </Card>

          <Card className={styles.expense} title="Gastos">
            <span className={`${styles.value} ${styles.valueNegative}`}>
              {money(data.expense, data.currency)}
            </span>
          </Card>

          <Card className={styles.count} title="Movimientos">
            <span className={styles.value}>{data.count}</span>
          </Card>

          <Card className={styles.accumulated} title="Balance acumulado">
            {data.timeline.length === 0 ? (
              <p className={styles.hint}>Sin movimientos en este periodo.</p>
            ) : (
              <BalanceChart
                currency={data.currency}
                formatMoney={money}
                data={data.timeline}
              />
            )}
          </Card>

          <Card className={styles.category} title="Gastos por categoría">
            {data.byCategory.length === 0 ? (
              <p className={styles.hint}>Sin gastos en este periodo.</p>
            ) : (
              <CategoryDonut
                currency={data.currency}
                formatMoney={money}
                data={data.byCategory.map((row) => ({
                  name:
                    row.categoryId === null
                      ? "Transferencias"
                      : row.name ?? "Sin categoría",
                  total: row.total,
                }))}
              />
            )}
          </Card>

          <Card className={styles.timeline} title="Evolución">
            {data.timeline.length === 0 ? (
              <p className={styles.hint}>Sin movimientos en este periodo.</p>
            ) : (
              <TimelineChart
                currency={data.currency}
                formatMoney={money}
                data={data.timeline}
              />
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
