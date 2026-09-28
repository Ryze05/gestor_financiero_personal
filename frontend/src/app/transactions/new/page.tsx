"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { HiArrowLeft } from "react-icons/hi2";
import Card from "@/components/Card";
import TransactionForm from "@/components/TransactionForm";
import Skeleton from "@/components/Skeleton";
import skeletonStyles from "@/components/skeleton.module.css";
import { api, ApiError } from "@/lib/api/client";
import type {
  Account,
  Category,
  CreateTransactionInput,
} from "@/lib/api/types";
import styles from "./new-transaction.module.css";

export default function NewTransactionPage() {
  const router = useRouter();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [accountsRes, categoriesRes] = await Promise.all([
          api.listAccounts({ page: 1, limit: 100 }),
          api.listCategories({ page: 1, limit: 100 }),
        ]);
        if (!cancelled) {
          setAccounts(accountsRes.data.filter((account) => !account.isArchived));
          setCategories(
            categoriesRes.data.filter((category) => !category.isArchived),
          );
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof ApiError
              ? err.message
              : "No se pudieron cargar los datos.",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleCreate(input: CreateTransactionInput) {
    await api.createTransaction(input);
    router.push("/transactions");
  }

  return (
    <div className={styles.page}>
      <Link href="/transactions" className={styles.back}>
        <HiArrowLeft />
        Volver a movimientos
      </Link>

      <h1>Nuevo movimiento</h1>

      {loading && (
        <div className={skeletonStyles.form}>
          <Skeleton className={skeletonStyles.formFieldShort} />
          <Skeleton className={skeletonStyles.formField} />
          <Skeleton className={skeletonStyles.formField} />
          <Skeleton className={skeletonStyles.formField} />
        </div>
      )}
      {!loading && error && <p className={styles.error}>{error}</p>}

      {!loading && !error && (
        <Card>
          <TransactionForm
            accounts={accounts}
            categories={categories}
            submitLabel="Guardar movimiento"
            onSubmit={handleCreate}
          />
        </Card>
      )}
    </div>
  );
}