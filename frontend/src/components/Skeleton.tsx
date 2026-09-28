import styles from "./skeleton.module.css";

export default function Skeleton({
  className = "",
  ...props
}: {
  className?: string;
  [key: string]: unknown;
}) {
  return (
    <div
      className={`${styles.skeleton} ${className}`}
      aria-hidden="true"
      {...props}
    />
  );
}