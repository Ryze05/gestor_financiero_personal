"use client";

import { useEffect, useState, type FormEvent } from "react";
import { HiPlus } from "react-icons/hi2";
import Card from "@/components/Card";
import Modal from "@/components/Dialog";
import SelectField from "@/components/Select";
import ColorPicker from "@/components/ColorPicker";
import { api, ApiError } from "@/lib/api/client";
import type { Category, CategoryType } from "@/lib/api/types";
import styles from "./categories.module.css";

const TYPE_LABEL: Record<CategoryType, string> = {
  EXPENSE: "Gasto",
  INCOME: "Ingreso",
  BOTH: "Ambos",
};

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState<CategoryType>("EXPENSE");
  const [color, setColor] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await api.listCategories();
        if (!cancelled) setCategories(res.data);
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof ApiError
              ? err.message
              : "No se pudieron cargar las categorías.",
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

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (submitting) return;

    const trimmedName = name.trim();
    if (!trimmedName) return setError("Introduce un nombre.");
    if (trimmedName.length > 80) {
      return setError("El nombre no puede superar 80 caracteres.");
    }

    setSubmitting(true);
    setError(null);
    try {
      await api.createCategory({
        name: trimmedName,
        type,
        color: color || undefined,
      });
      setName("");
      setType("EXPENSE");
      setColor("");
      const res = await api.listCategories();
      setCategories(res.data);
      setOpen(false);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "No se pudo crear la categoría.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Finanzas</p>
          <h1>Categorías</h1>
          <p className={styles.description}>Organiza tus ingresos y gastos.</p>
        </div>

        <Modal
          title="Nueva categoría"
          open={open}
          onOpenChange={setOpen}
          trigger={
            <button type="button" className={styles.primaryButton}>
              <HiPlus />
              Nueva categoría
            </button>
          }
        >
          <form className={styles.form} onSubmit={handleSubmit}>
            <label className={styles.field}>
              <span className={styles.label}>Nombre</span>
              <input
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </label>

            <div className={styles.field}>
              <span className={styles.label}>Tipo</span>
              <SelectField
                value={type}
                onChange={(value) => setType(value as CategoryType)}
                ariaLabel="Tipo"
                options={[
                  { value: "EXPENSE", label: "Gasto" },
                  { value: "INCOME", label: "Ingreso" },
                  { value: "BOTH", label: "Ambos" },
                ]}
              />
            </div>

            <div className={styles.field}>
              <span className={styles.label}>Color (opcional)</span>
              <ColorPicker value={color} onChange={setColor} />
            </div>

            {error && <p className={styles.error}>{error}</p>}

            <button
              type="submit"
              className={styles.primaryButton}
              aria-disabled={submitting}
            >
              {submitting ? "Creando..." : "Crear categoría"}
            </button>
          </form>
        </Modal>
      </header>

      <Card>
        <div className={styles.listHeader}>
          <h2>Categorías</h2>
          <span className={styles.count}>{categories.length}</span>
        </div>

        {loading && <p className={styles.hint}>Cargando...</p>}
        {!loading && error && <p className={styles.error}>{error}</p>}
        {!loading && !error && categories.length === 0 && (
          <p className={styles.hint}>No hay categorías todavía.</p>
        )}
        {!loading && !error && categories.length > 0 && (
          <ul className={styles.list}>
            {categories.map((category) => (
              <li key={category.id} className={styles.row}>
                <div className={styles.rowInfo}>
                  <span
                    className={styles.swatch}
                    style={{ background: category.color ?? "var(--border)" }}
                  />
                  <strong>{category.name}</strong>
                </div>
                <span className={styles.type}>{TYPE_LABEL[category.type]}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}