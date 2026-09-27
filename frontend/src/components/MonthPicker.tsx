"use client";

import { useEffect, useRef, useState } from "react";
import { HiCalendarDays, HiChevronLeft, HiChevronRight } from "react-icons/hi2";
import styles from "./month-picker.module.css";

const MONTHS = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

export default function MonthPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [year, setYear] = useState(() => Number(value.slice(0, 4)));
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const selectedYear = Number(value.slice(0, 4));
  const selectedMonth = Number(value.slice(5, 7));
  const label = `${MONTHS[selectedMonth - 1]} ${selectedYear}`;

  return (
    <div className={styles.root} ref={rootRef}>
      <button
        type="button"
        className={styles.trigger}
        onClick={() => setOpen((v) => !v)}
      >
        <HiCalendarDays className={styles.triggerIcon} />
        <span>{label}</span>
      </button>

      {open && (
        <>
          <div className={styles.backdrop} onClick={() => setOpen(false)} />
          <div className={styles.popover}>
            <div className={styles.header}>
              <button
                type="button"
                onClick={() => setYear((y) => y - 1)}
                aria-label="Año anterior"
              >
                <HiChevronLeft />
              </button>
              <span className={styles.yearLabel}>{year}</span>
              <button
                type="button"
                onClick={() => setYear((y) => y + 1)}
                aria-label="Año siguiente"
              >
                <HiChevronRight />
              </button>
            </div>
            <div className={styles.grid}>
              {MONTHS.map((name, i) => {
                const month = i + 1;
                const active = year === selectedYear && month === selectedMonth;
                return (
                  <button
                    key={name}
                    type="button"
                    onClick={() => {
                      onChange(`${year}-${String(month).padStart(2, "0")}`);
                      setOpen(false);
                    }}
                    className={active ? styles.monthActive : styles.month}
                  >
                    {name}
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
