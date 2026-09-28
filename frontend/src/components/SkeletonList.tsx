import Skeleton from "./Skeleton";
import styles from "./skeleton.module.css";

export default function SkeletonList({
  rows = 5,
  variant = "amount",
}: {
  rows?: number;
  variant?: "amount" | "actions" | "category";
}) {
  return (
    <div className={styles.list}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className={styles.row}>
          <div
            className={variant === "category" ? styles.infoInline : styles.info}
          >
            {variant === "category" && <Skeleton className={styles.swatch} />}
            <div className={styles.infoText}>
              <Skeleton className={styles.line} />
              <Skeleton className={styles.lineShort} />
            </div>
          </div>
          {variant === "amount" ? (
            <Skeleton className={styles.amount} />
          ) : (
            <Skeleton className={styles.actions} />
          )}
        </div>
      ))}
    </div>
  );
}