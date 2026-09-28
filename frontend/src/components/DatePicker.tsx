"use client";

import { useState } from "react";
import * as Popover from "@radix-ui/react-popover";
import { DayPicker, type Matcher } from "react-day-picker";
import { es } from "react-day-picker/locale";
import { HiCalendarDays } from "react-icons/hi2";
import "react-day-picker/style.css";
import styles from "./date-picker.module.css";

export default function DatePicker({
  value,
  onChange,
  placeholder = "Seleccionar fecha",
  disabled = false,
  matcher,
}: {
  value: Date | undefined;
  onChange: (date: Date | undefined) => void;
  placeholder?: string;
  disabled?: boolean;
  matcher?: Matcher | Matcher[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <Popover.Root open={disabled ? false : open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          className={styles.trigger}
          onClick={(event) => {
            if (disabled) event.preventDefault();
          }}
          aria-disabled={disabled}
        >
          <HiCalendarDays className={styles.triggerIcon} />
          <span>
            {value ? value.toLocaleDateString("es-ES") : placeholder}
          </span>
        </button>
      </Popover.Trigger>

      {!disabled && (
        <Popover.Portal>
          <Popover.Content
            className={styles.popover}
            sideOffset={8}
            collisionPadding={16}
          >
            <DayPicker
              mode="single"
              selected={value}
          onSelect={(date) => {
            onChange(date);
            setOpen(false);
          }}
              disabled={matcher}
              locale={es}
              weekStartsOn={1}
              defaultMonth={value}
            />
          </Popover.Content>
        </Popover.Portal>
      )}
    </Popover.Root>
  );
}
