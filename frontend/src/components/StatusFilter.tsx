"use client";

import styles from "./status-filter.module.css";

export type StatusFilterValue = "active" | "archived" | "all";

const OPTIONS: { value: StatusFilterValue; label: string }[] = [
  { value: "active", label: "Activas" },
  { value: "archived", label: "Archivadas" },
  { value: "all", label: "Todas" },
];

export default function StatusFilter({
  value,
  onChange,
}: {
  value: StatusFilterValue;
  onChange: (value: StatusFilterValue) => void;
}) {
  return (
    <div className={styles.filters} role="group" aria-label="Filtrar por estado">
      {OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          aria-pressed={value === option.value}
          className={value === option.value ? styles.chipActive : styles.chip}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}