"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Currency } from "@/lib/api/types";
import styles from "./balance-chart.module.css";

type TimelineItem = {
  date: string;
  income: string;
  expense: string;
  transferIn: string;
  transferOut: string;
};

export default function BalanceChart({
  data,
  currency,
  formatMoney,
}: {
  data: TimelineItem[];
  currency: Currency;
  formatMoney: (amount: string, currency: Currency) => string;
}) {
  const chartData = data.reduce<
    Array<{ date: string; balance: number }>
  >((acc, item) => {
    const previous = acc.length > 0 ? acc[acc.length - 1].balance : 0;
    const balance =
      previous +
      Number(item.income) +
      Number(item.transferIn) -
      Number(item.expense) -
      Number(item.transferOut);
    acc.push({ date: item.date.slice(5), balance });
    return acc;
  }, []);

  return (
    <div className={styles.chart}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis dataKey="date" stroke="var(--text-secondary)" fontSize={12} />
          <YAxis stroke="var(--text-secondary)" fontSize={12} width={45} />
          <Tooltip
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null;
              return (
                <div className={styles.tooltip}>
                  <strong>{label}</strong>
                  <span>
                    Balance:{" "}
                    {formatMoney(String(payload[0].value ?? 0), currency)}
                  </span>
                </div>
              );
            }}
          />
          <Line
            type="monotone"
            dataKey="balance"
            name="Balance"
            stroke="var(--primary)"
            strokeWidth={2}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}