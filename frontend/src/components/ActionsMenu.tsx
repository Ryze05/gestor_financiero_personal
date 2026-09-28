"use client";

import type { ReactNode } from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { HiEllipsisHorizontal } from "react-icons/hi2";
import styles from "./actions-menu.module.css";

export interface ActionItem {
  label: string;
  icon?: ReactNode;
  onSelect: () => void;
  danger?: boolean;
}

export default function ActionsMenu({
  items,
  ariaLabel = "Acciones",
  disabled = false,
}: {
  items: ActionItem[];
  ariaLabel?: string;
  disabled?: boolean;
}) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger
        className={styles.trigger}
        aria-label={ariaLabel}
        aria-disabled={disabled}
        disabled={disabled}
      >
        <HiEllipsisHorizontal />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          className={styles.content}
          align="end"
          sideOffset={6}
        >
          {items.map((item) => (
            <DropdownMenu.Item
              key={item.label}
              className={item.danger ? styles.itemDanger : styles.item}
              onSelect={item.onSelect}
            >
              {item.icon}
              {item.label}
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
