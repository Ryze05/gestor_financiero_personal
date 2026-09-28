import Skeleton from "./Skeleton";
import styles from "./skeleton-select.module.css";

export default function SkeletonSelect() {
  return <Skeleton className={styles.select} />;
}
