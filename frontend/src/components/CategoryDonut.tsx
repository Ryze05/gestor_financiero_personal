"use client";

import { useState } from "react";
import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import type { Currency } from "@/lib/api/types";
import styles from "./category-donut.module.css";

const COLORS = [
  "#a78bfa",
  "#fda4af",
  "#67e8f9",
  "#86efac",
  "#fcd34d",
  "#c4b5fd",
];

type CategoryItem = {
  name: string;
  total: string;
};

export default function CategoryDonut({
  data,
  currency,
  formatMoney,
}: {
  data: CategoryItem[];
  currency: Currency;
  formatMoney: (amount: string, currency: Currency) => string;
}) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const chartData = data.map((item) => ({
    name: item.name,
    value: Number(item.total),
  }));

  return (
    <div className={styles.layout}>
      <div className={styles.chart}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              dataKey="value"
              nameKey="name"
              innerRadius="62%"
              outerRadius="88%"
              paddingAngle={3}
              onMouseEnter={(_, index) => setActiveIndex(index)}
              onMouseLeave={() => setActiveIndex(null)}
            >
              {chartData.map((item, index) => (
                <Cell
                  key={item.name}
                  fill={COLORS[index % COLORS.length]}
                  opacity={
                    activeIndex === null || activeIndex === index ? 1 : 0.35
                  }
                />
              ))}
            </Pie>
            <Tooltip
              formatter={(value) => formatMoney(String(value), currency)}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <div className={styles.legend}>
        {chartData.map((item, index) => (
          <div
            key={item.name}
            className={styles.legendItem}
            onMouseEnter={() => setActiveIndex(index)}
            onMouseLeave={() => setActiveIndex(null)}
          >
            <span
              className={styles.dot}
              style={{ backgroundColor: COLORS[index % COLORS.length] }}
            />
            <span className={styles.name}>{item.name}</span>
            <span className={styles.value}>
              {formatMoney(item.value.toString(), currency)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
