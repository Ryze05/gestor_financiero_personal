"use client";

import { useState } from "react";
import { HexColorPicker } from "react-colorful";
import styles from "./color-picker.module.css";

const COLORS = [
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#14b8a6",
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
];

export default function ColorPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (color: string) => void;
}) {
  const [openPicker, setOpenPicker] = useState(false);
  const isCustom = Boolean(value) && !COLORS.includes(value);

  return (
    <div className={styles.root}>
      <div className={styles.swatches}>
        {COLORS.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => onChange(value === option ? "" : option)}
            className={value === option ? styles.swatchActive : styles.swatch}
            style={{ background: option }}
            aria-label={`Color ${option}`}
          />
        ))}

        <button
          type="button"
          onClick={() => setOpenPicker((current) => !current)}
          className={styles.custom}
          aria-label="Color personalizado"
        >
          {isCustom ? (
            <span
              className={styles.customSwatch}
              style={{ background: value }}
            />
          ) : (
            "Personalizado"
          )}
        </button>

        {value && (
          <button
            type="button"
            onClick={() => onChange("")}
            className={styles.clear}
          >
            Sin color
          </button>
        )}
      </div>

      {openPicker && (
        <div className={styles.pickerWrap}>
          <HexColorPicker color={value || "#8b5cf6"} onChange={onChange} />
        </div>
      )}
    </div>
  );
}