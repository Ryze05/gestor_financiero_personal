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
import styles from "./mobile-nav.module.css";

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

export default function MobileNav() {
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();

  return (
    <div className={styles.mobile}>
      <header className={styles.topbar}>
        <Link href="/" className={styles.brand}>
          Finanzas
        </Link>
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
      </header>

      <nav className={styles.bottomNav}>
        {NAV_LINKS.map(
          ({ href, label, icon: Icon, iconOutline: IconOutline }) => {
            const active = pathname === href;
            const Current = active ? Icon : IconOutline;
            return (
              <Link
                key={href}
                href={href}
                className={active ? styles.itemActive : styles.item}
              >
                <Current />
                <span>{label}</span>
              </Link>
            );
          },
        )}
      </nav>
    </div>
  );
}