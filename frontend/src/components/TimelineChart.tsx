"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Currency } from "@/lib/api/types";
import styles from "./timeline-chart.module.css";

type TimelineItem = {
  date: string;
  income: string;
  expense: string;
  transferIn: string;
  transferOut: string;
};

export default function TimelineChart({
  data,
  currency,
  formatMoney,
}: {
  data: TimelineItem[];
  currency: Currency;
  formatMoney: (amount: string, currency: Currency) => string;
}) {
  const chartData = data.map((item) => ({
    date: item.date.slice(5),
    income: Number(item.income),
    expense: Number(item.expense),
    transferIn: Number(item.transferIn),
    transferOut: Number(item.transferOut),
  }));

  return (
    <div className={styles.chart}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis dataKey="date" stroke="var(--text-secondary)" fontSize={12} />
          <YAxis stroke="var(--text-secondary)" fontSize={12} width={45} />
          <Tooltip
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null;
              return (
                <div className={styles.tooltip}>
                  <strong>{label}</strong>
                  {payload.map((entry) => (
                    <span key={String(entry.dataKey)}>
                      {entry.name}:{" "}
                      {formatMoney(String(entry.value ?? 0), currency)}
                    </span>
                  ))}
                </div>
              );
            }}
          />
          <Area
            type="monotone"
            dataKey="income"
            name="Ingresos"
            stroke="var(--positive)"
            fill="var(--positive)"
            fillOpacity={0.15}
          />
          <Area
            type="monotone"
            dataKey="expense"
            name="Gastos"
            stroke="var(--negative)"
            fill="var(--negative)"
            fillOpacity={0.15}
          />
          <Area
            type="monotone"
            dataKey="transferIn"
            name="Transferencias entrantes"
            stroke="var(--accent)"
            fill="var(--accent)"
            fillOpacity={0.15}
          />
          <Area
            type="monotone"
            dataKey="transferOut"
            name="Transferencias salientes"
            stroke="var(--primary)"
            fill="var(--primary)"
            fillOpacity={0.15}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}