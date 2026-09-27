"use client";

import type { ReactNode } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { HiXMark } from "react-icons/hi2";
import styles from "./dialog.module.css";

export default function Modal({
  trigger,
  title,
  open,
  onOpenChange,
  children,
}: {
  trigger?: ReactNode;
  title: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: ReactNode;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      {trigger && <Dialog.Trigger asChild>{trigger}</Dialog.Trigger>}
      <Dialog.Portal>
        <Dialog.Overlay className={styles.overlay} />
        <Dialog.Content className={styles.content}>
          <div className={styles.header}>
            <Dialog.Title className={styles.title}>{title}</Dialog.Title>
            <Dialog.Close className={styles.close} aria-label="Cerrar">
              <HiXMark />
            </Dialog.Close>
          </div>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}