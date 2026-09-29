"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api, ApiError } from "@/lib/api/client";
import type { Account, DashboardSummary, Transaction } from "@/lib/api/types";
import Card from "@/components/Card";
import CategoryDonut from "@/components/CategoryDonut";
import BalanceChart from "@/components/BalanceChart";
import TimelineChart from "@/components/TimelineChart";
import MonthPicker from "@/components/MonthPicker";
import SelectField from "@/components/Select";
import DashboardSkeleton from "@/components/DashboardSkeleton";
import SkeletonSelect from "@/components/SkeletonSelect";
import Skeleton from "@/components/Skeleton";
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
  const [recent, setRecent] = useState<Transaction[]>([]);
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
        const [res, accountsRes, recentRes] = await Promise.all([
          api.getDashboard({
            ...monthRange(month),
            accountId,
          }),
          api.listAccounts({ page: 1, limit: 100 }),
          api.listTransactions({ accountId, page: 1, limit: 5 }),
        ]);
        if (!cancelled) {
          setData(res);
          setAccounts(
            accountsRes.data.filter((account) => !account.isArchived),
          );
          setRecent(recentRes.data);
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
        <div className={styles.accountFilter}>
          {accountId ? (
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
          ) : (
            <SkeletonSelect />
          )}
        </div>
      </div>

      <section className={styles.hero}>
        {loading ? (
          <>
            <div className={styles.heroBalance}>
              <Skeleton className={styles.skeletonLabel} />
              <div className={styles.heroBalanceValue}>
                <Skeleton className={styles.skeletonValue} />
                <Skeleton className={styles.skeletonAccount} />
              </div>
            </div>
            <div className={styles.heroMovements}>
              <Skeleton className={styles.skeletonLabel} />
              <div className={styles.movementsList}>
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className={styles.movement}>
                    <Skeleton className={styles.skeletonRow} />
                    <Skeleton className={styles.skeletonAmount} />
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : (
          <>
            <div className={styles.heroBalance}>
              <span className={styles.heroLabel}>Saldo actual</span>
              <div className={styles.heroBalanceValue}>
                <span className={styles.heroValue}>
                  {selectedAccount
                    ? money(
                        selectedAccount.currentBalance,
                        selectedAccount.currency,
                      )
                    : "—"}
                </span>
                <span className={styles.heroAccount}>
                  {selectedAccount?.name ?? ""}
                </span>
              </div>
            </div>
            <div className={styles.heroMovements}>
              <div className={styles.heroMovementsHeader}>
                <span className={styles.heroLabel}>Últimos movimientos</span>
                <Link href="/transactions" className={styles.heroLink}>
                  Ver más →
                </Link>
              </div>
              {recent.length === 0 ? (
                <p className={styles.hint}>Sin movimientos.</p>
              ) : (
                <ul className={styles.movementsList}>
                  {recent.map((tx) => (
                    <li key={tx.id} className={styles.movement}>
                      <span className={styles.movementLeft}>
                        <span className={styles.movementDate}>
                          {tx.date.slice(0, 10)}
                        </span>
                        <span className={styles.movementConcept}>
                          {tx.concept}
                        </span>
                      </span>
                      <span
                        className={`${styles.movementAmount} ${
                          tx.type === "INCOME"
                            ? styles.valuePositive
                            : styles.valueNegative
                        }`}
                      >
                        {tx.type === "INCOME"
                          ? `+${money(tx.accountAmount, tx.currency)}`
                          : `-${money(tx.accountAmount, tx.currency)}`}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}
      </section>

      <div className={styles.controls}>
        {loading ? (
          <Skeleton className={styles.skeletonMonth} />
        ) : (
          <MonthPicker value={month} onChange={setMonth} />
        )}
      </div>

      {loading && <DashboardSkeleton />}
      {!loading && error && <p className={styles.error}>{error}</p>}

      {!loading && !error && data && (
        <div className={styles.grid}>
          <Card className={styles.income} title="Ingresos del mes">
            <span className={`${styles.value} ${styles.valuePositive}`}>
              {money(data.income, data.currency)}
            </span>
          </Card>

          <Card className={styles.expense} title="Gastos del mes">
            <span className={`${styles.value} ${styles.valueNegative}`}>
              {money(data.expense, data.currency)}
            </span>
          </Card>

          <Card className={styles.count} title="Movimientos del mes">
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
                openingBalance={data.openingBalance}
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
                  name: row.name ?? "Sin categoría",
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
