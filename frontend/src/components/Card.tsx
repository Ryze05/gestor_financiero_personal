import type { ReactNode } from "react";
import styles from "./card.module.css";

export default function Card({
  title,
  children,
  className,
}: {
  title?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className ? `${styles.card} ${className}` : styles.card}>
      {title && <h2 className={styles.title}>{title}</h2>}
      {children}
    </div>
  );
}