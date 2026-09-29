"use client";

import { useState } from "react";
import {
  HiChevronDown,
  HiChevronUp,
  HiShoppingCart,
} from "react-icons/hi2";
import { formatMoney } from "@/lib/utils/money";
import type { Receipt, Transaction } from "@/lib/api/types";
import styles from "./ticket-row.module.css";

interface TicketRowProps {
  receipt: Receipt;
  lines: Transaction[];
}

export default function TicketRow({ receipt, lines }: TicketRowProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className={styles.wrapper}>
      <button
        type="button"
        className={styles.header}
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
      >
        <div className={styles.headerInfo}>
          <HiShoppingCart className={styles.ticketIcon} />
          <div>
            <strong>{receipt.merchant ?? "Ticket"}</strong>
            <span>
              {receipt.date.slice(0, 10)} · {receipt.account?.name ?? "—"}{" "}
              · {lines.length}{" "}
              {lines.length === 1 ? "item" : "items"}
            </span>
          </div>
        </div>
        <div className={styles.headerActions}>
          <span className={styles.total}>
            -{formatMoney(receipt.total, receipt.currency)}
          </span>
          {open ? <HiChevronUp /> : <HiChevronDown />}
        </div>
      </button>

      {open && (
        <div className={styles.lines}>
          {lines.map((line) => (
            <div key={line.id} className={styles.line}>
              <div className={styles.lineInfo}>
                <strong>{line.concept}</strong>
                <span>{line.category?.name ?? "Sin categoría"}</span>
              </div>
              <div className={styles.lineActions}>
                <span className={styles.expenseAmount}>
                  -{formatMoney(line.amount, line.currency)}
                </span>
                {line.exchangeRate !== "1" && (
                  <span className={styles.converted}>
                    →{" "}
                    {formatMoney(
                      line.accountAmount,
                      line.account?.currency ?? line.currency,
                    )}{" "}
                    @ {line.exchangeRate}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}