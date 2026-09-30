import Link from "next/link";
import { HiArrowLeft, HiMagnifyingGlass } from "react-icons/hi2";
import styles from "./not-found.module.css";

export default function NotFound() {
  return (
    <section className={styles.page}>
      <div className={styles.card}>
        <span className={styles.code}>404</span>

        <div className={styles.icon} aria-hidden="true">
          <HiMagnifyingGlass />
        </div>

        <h1>Página no encontrada</h1>

        <p>
          No hemos encontrado la página que buscas. Puede que la dirección haya
          cambiado o que ya no exista.
        </p>

        <Link href="/" className={styles.link}>
          <HiArrowLeft />
          Volver al dashboard
        </Link>
      </div>
    </section>
  );
}
