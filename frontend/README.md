# Frontend — Finanzas Personales

Aplicación web en Next.js 16 (App Router) que consume la API REST del backend NestJS. Permite consultar el dashboard, gestionar movimientos, cuentas, categorías, transferencias y tickets, con temas claro/oscuro y diseño responsive.

## Stack

- Next.js 16 (App Router) con React 19 y TypeScript.
- CSS Modules para estilos (no Tailwind).
- Primitivas de Radix UI: `select`, `dialog`, `dropdown-menu`, `popover`.
- `react-day-picker` para fechas, mes propio (`MonthPicker`) y `react-colorful` para color.
- Iconos de `react-icons/hi2` (Heroicons v2).
- `recharts` para el gráfico de categorías y la evolución temporal.
- Cliente HTTP basado en `fetch` (sin axios).

## Requisitos

- Node.js LTS y `pnpm`.
- Backend en marcha (`docker compose up -d` + `pnpm start:dev` desde `backend/`).

## Configuración

Copia `frontend/.env.example` a `frontend/.env` (no versionado), con la URL de la API:

```env
NEXT_PUBLIC_API_URL=http://localhost:3001/api/v1
```

Si no se define, el cliente usa `http://localhost:3001/api/v1` por defecto. El backend habilita CORS solo para `http://localhost:3000`.

## Puesta en marcha

```bash
pnpm install
pnpm dev
```

Disponible en `http://localhost:3000`.

## Comandos

```bash
pnpm dev      # Servidor de desarrollo
pnpm build    # Build de producción
pnpm start    # Servir el build
pnpm lint     # ESLint
```

> No hay script `pnpm test` en este paquete; se verifica con `pnpm lint` y `pnpm build`.

## Rutas

| Ruta | Descripción |
|---|---|
| `/` | Dashboard: saldo actual (all-time), resumen del mes, donut por categoría y evolución temporal |
| `/transactions` | Listado de movimientos con filtros y acciones de editar/borrar |
| `/transactions/new` | Alta de movimiento |
| `/accounts` | Gestión de cuentas (crear, editar, archivar/restaurar) |
| `/categories` | Gestión de categorías (crear, editar, archivar/restaurar) |
| `/transfers` | Listado, alta, edición y borrado de transferencias |
| `/tickets/new` | Alta de ticket agrupado por categorías (Nivel 2) |
| `not-found` | Página 404 |

## Estructura

```text
frontend/
├── public/
└── src/
    ├── app/          Páginas (App Router) y estilos de página
    ├── components/   UI reutilizable (Card, Select, DatePicker, formularios, skeletons…)
    └── lib/
        ├── api/      client.ts (fetch + ApiError) y types.ts
        ├── context/  theme-context / theme-provider
        └── utils/    date.ts y money.ts
```

## Cliente API

- Todas las peticiones pasan por `src/lib/api/client.ts` con tipos en `src/lib/api/types.ts`.
- El cliente lanza `ApiError` (mensaje + estado HTTP + body); si falla la red, usa estado `0` con el mensaje "No se pudo conectar con el servidor.".
- Los importes llegan como **string** (serialización de `Decimal`) y se formatean con `formatMoney` (`src/lib/utils/money.ts`).
- Los listados aceptan `{ page, limit }` (por defecto 20, máximo 100). `transactions` admite además `accountId`, `source`, `minAmount` y `maxAmount`.
- `toApiDate` (`src/lib/utils/date.ts`) formatea una fecha a `YYYY-MM-DD` para query/body.

## Theming y componentes

- Temas claro/oscuro mediante variables CSS en `src/app/globals.css` (`:root` y `.dark`); el estado vive en `src/lib/context/` y persiste en `localStorage`.
- `src/app/layout.tsx` incluye un script anti-flash, `<html lang="es" suppressHydrationWarning>` y las fuentes Space Grotesk, Inter y JetBrains Mono.
- Layout: `Sidebar` (≥768px) y `MobileNav` (<768px).
- Formularios: `TransactionForm`, `ReceiptForm`, `Select`, `DatePicker`, `ColorPicker`.
- Listados: `ActionsMenu`, `StatusFilter`, `MonthPicker`, skeletons de carga.
- Patrón de datos: `useEffect` con `load()` async y bandera `cancelled`; mutaciones con booleano `submitting`/`busy` (usando `aria-disabled` + guard para evitar warnings de hidratación).

## Tests

Según `AGENTS.md`, se prueban validación de formularios, filtros, estados de carga/error, cálculos mostrados en el dashboard y el flujo principal de alta de gasto; los detalles puramente visuales no requieren tests exhaustivos.

## Convenciones

Ver `AGENTS.md` en este directorio para las convenciones de trabajo del paquete.
