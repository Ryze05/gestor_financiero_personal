"use client";

import type { ReactNode } from "react";
import Modal from "@/components/Dialog";
import styles from "./confirm-dialog.module.css";

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Continuar",
  cancelLabel = "Cancelar",
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal
      open={open}
      title={title}
      onOpenChange={(next) => {
        if (!next) onCancel();
      }}
    >
      <p className={styles.message}>{message}</p>
      <div className={styles.actions}>
        <button className={styles.cancel} onClick={onCancel}>
          {cancelLabel}
        </button>
        <button className={styles.confirm} onClick={onConfirm}>
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}