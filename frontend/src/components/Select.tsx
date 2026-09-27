"use client";

import * as Select from "@radix-ui/react-select";
import { HiCheck, HiChevronDown } from "react-icons/hi2";
import styles from "./select.module.css";

export interface SelectOption {
  value: string;
  label: string;
}

export default function SelectField({
  value,
  onChange,
  options,
  placeholder = "Selecciona una opción",
  ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  ariaLabel?: string;
}) {
  return (
    <Select.Root value={value || undefined} onValueChange={onChange}>
      <Select.Trigger className={styles.trigger} aria-label={ariaLabel}>
        <Select.Value placeholder={placeholder} />
        <Select.Icon className={styles.icon}>
          <HiChevronDown />
        </Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Content
          className={styles.content}
          position="popper"
          sideOffset={6}
        >
          <Select.Viewport className={styles.viewport}>
            {options.map((option) => (
              <Select.Item
                key={option.value}
                value={option.value}
                className={styles.item}
              >
                <Select.ItemText>{option.label}</Select.ItemText>
                <Select.ItemIndicator className={styles.indicator}>
                  <HiCheck />
                </Select.ItemIndicator>
              </Select.Item>
            ))}
          </Select.Viewport>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  );
}