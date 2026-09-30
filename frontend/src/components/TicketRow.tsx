"use client";

import { useState } from "react";
import {
  HiChevronDown,
  HiChevronUp,
  HiPencil,
  HiTrash,
} from "react-icons/hi2";
import ActionsMenu from "@/components/ActionsMenu";
import { formatMoney } from "@/lib/utils/money";
import type { Receipt, Transaction } from "@/lib/api/types";
import styles from "./ticket-row.module.css";

interface TicketRowProps {
  receipt: Receipt;
  lines: Transaction[];
  onDelete?: (id: string) => void;
  onEdit?: (receipt: Receipt) => void;
}

export default function TicketRow({
  receipt,
  lines,
  onDelete,
  onEdit,
}: TicketRowProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className={styles.wrapper}>
      <div className={styles.header}>
        <button
          type="button"
          className={styles.headerMain}
          onClick={() => setOpen((current) => !current)}
          aria-expanded={open}
        >
          {open ? <HiChevronUp /> : <HiChevronDown />}
          <div className={styles.headerInfo}>
            <div>
              <strong>{receipt.merchant ?? "Ticket"}</strong>
              <span>
                {receipt.date.slice(0, 10)} · {receipt.account?.name ?? "—"}{" "}
                · {lines.length}{" "}
                {lines.length === 1 ? "item" : "items"}
              </span>
            </div>
          </div>
        </button>

        <div className={styles.headerActions}>
          <span className={styles.total}>
            -{formatMoney(
              String(
                lines.reduce((sum, l) => sum + Number(l.accountAmount), 0),
              ),
              lines[0]?.account?.currency ?? receipt.currency,
            )}
          </span>
          {receipt.currency !==
            (lines[0]?.account?.currency ?? receipt.currency) && (
            <span className={styles.converted}>
              ({formatMoney(receipt.total, receipt.currency)})
            </span>
          )}
          {(onEdit || onDelete) && (
            <ActionsMenu
              items={[
                ...(onEdit
                  ? [
                      {
                        label: "Editar",
                        icon: <HiPencil />,
                        onSelect: () => onEdit(receipt),
                      },
                    ]
                  : []),
                {
                  label: "Eliminar",
                  icon: <HiTrash />,
                  onSelect: () => onDelete?.(receipt.id),
                  danger: true,
                },
              ]}
            />
          )}
        </div>
      </div>

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
                  -{formatMoney(
                    line.accountAmount,
                    line.account?.currency ?? line.currency,
                  )}
                </span>
                {line.exchangeRate !== "1" && (
                  <span className={styles.converted}>
                    (
                    {formatMoney(line.amount, line.currency)} @{" "}
                    {line.exchangeRate})
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
