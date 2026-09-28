import Skeleton from "./Skeleton";
import styles from "./DashboardSkeleton.module.css";

function MetricSkeleton() {
  return (
    <div className={styles.metric}>
      <Skeleton className={styles.label} />
      <Skeleton className={styles.value} />
    </div>
  );
}

function ChartSkeleton() {
  return (
    <div className={styles.chart}>
      <Skeleton className={styles.label} />
      <Skeleton className={styles.chartBody} />
    </div>
  );
}

export default function DashboardSkeleton() {
  return (
    <div className={styles.grid}>
      <MetricSkeleton />
      <MetricSkeleton />
      <MetricSkeleton />
      <MetricSkeleton />
      <ChartSkeleton />
      <ChartSkeleton />
      <ChartSkeleton />
    </div>
  );
}
