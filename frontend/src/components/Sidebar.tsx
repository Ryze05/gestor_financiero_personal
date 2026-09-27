"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  HiChartPie,
  HiOutlineChartPie,
  HiBanknotes,
  HiOutlineBanknotes,
  HiWallet,
  HiOutlineWallet,
  HiTag,
  HiOutlineTag,
  HiSun,
  HiMoon,
} from "react-icons/hi2";
import { useTheme } from "@/lib/context/theme-context";
import styles from "./sidebar.module.css";

const NAV_LINKS = [
  {
    href: "/",
    label: "Dashboard",
    icon: HiChartPie,
    iconOutline: HiOutlineChartPie,
  },
  {
    href: "/transactions",
    label: "Movimientos",
    icon: HiBanknotes,
    iconOutline: HiOutlineBanknotes,
  },
  {
    href: "/accounts",
    label: "Cuentas",
    icon: HiWallet,
    iconOutline: HiOutlineWallet,
  },
  {
    href: "/categories",
    label: "Categorías",
    icon: HiTag,
    iconOutline: HiOutlineTag,
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();

  return (
    <aside className={styles.sidebar}>
      <Link href="/" className={styles.brand}>
        Finanzas
      </Link>
      <nav className={styles.nav}>
        {NAV_LINKS.map(
          ({ href, label, icon: Icon, iconOutline: IconOutline }) => {
            const active = pathname === href;
            const Current = active ? Icon : IconOutline;
            return (
              <Link
                key={href}
                href={href}
                className={active ? styles.active : styles.link}
              >
                <Current className={styles.linkIcon} />
                <span>{label}</span>
              </Link>
            );
          },
        )}
      </nav>
      <button
        type="button"
        onClick={toggleTheme}
        className={styles.themeToggle}
        aria-label={
          theme === "dark" ? "Activar modo claro" : "Activar modo oscuro"
        }
        title={theme === "dark" ? "Modo claro" : "Modo oscuro"}
      >
        {theme === "dark" ? <HiSun /> : <HiMoon />}
      </button>
    </aside>
  );
}