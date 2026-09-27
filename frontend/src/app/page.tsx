"use client";

import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api/client";
import type { DashboardSummary } from "@/lib/api/types";
import Card from "@/components/Card";
import styles from "./dashboard.module.css";

function monthRange(value: string): { from: string; to: string } {
  const [year, month] = value.split("-").map(Number);
  const lastDay = new Date(year, month, 0).getDate();
  return {
    from: `${value}-01`,
    to: `${value}-${String(lastDay).padStart(2, "0")}`,
  };
}

const CURRENCIES = ["EUR", "USD"] as const;

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
  const [currency, setCurrency] = useState<"EUR" | "USD">("EUR");
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await api.getDashboard({
          ...monthRange(month),
          currency,
        });
        if (!cancelled) setData(res);
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
  }, [month, currency]);

  return (
    <div className={styles.page}>
      <div className={styles.controls}>
        <input
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className={styles.monthInput}
          aria-label="Mes"
        />
        <div className={styles.currencyGroup}>
          {CURRENCIES.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCurrency(c)}
              className={
                currency === c ? styles.currencyActive : styles.currencyBtn
              }
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {loading && <p className={styles.hint}>Cargando...</p>}
      {!loading && error && <p className={styles.error}>{error}</p>}

      {!loading && !error && data && (
        <div className={styles.grid}>
          <Card className={styles.balance} title="Balance">
            <span className={styles.balanceAmount}>
              {money(data.balance, data.currency)}
            </span>
          </Card>

          <Card className={styles.income} title="Ingresos">
            <span className={styles.amount}>
              {money(data.income, data.currency)}
            </span>
          </Card>

          <Card className={styles.expense} title="Gastos">
            <span className={styles.amount}>
              {money(data.expense, data.currency)}
            </span>
          </Card>

          <Card className={styles.count} title="Movimientos">
            <span className={styles.countNumber}>{data.count}</span>
          </Card>

          <Card className={styles.category} title="Gastos por categoría">
            {data.byCategory.length === 0 ? (
              <p className={styles.hint}>Sin gastos en este periodo.</p>
            ) : (
              <ul className={styles.categoryList}>
                {data.byCategory.map((row) => (
                  <li
                    key={row.categoryId ?? "sin-categoria"}
                    className={styles.categoryRow}
                  >
                    <span className={styles.categoryName}>
                      {row.name ?? "Sin categoría"}
                    </span>
                    <span className={styles.categoryTotal}>
                      {money(row.total, data.currency)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}