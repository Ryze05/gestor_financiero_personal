# Frontend Guide

## Stack

- Next.js 16 (App Router) with React 19 and TypeScript.
- CSS Modules for component styles; do not introduce Tailwind for this project.
- Icons: `react-icons/hi2` (Heroicons v2). Nav items use the filled/outline pair pattern (`HiXxx` when active, `HiOutlineXxx` otherwise).
- Typography via `next/font/google`: Space Grotesk (headings), Inter (body), JetBrains Mono (money/numbers). Exposed as `--font-space-grotesk`, `--font-inter`, `--font-jetbrains-mono` and set on `<body>` (not `<html>`, to avoid a Turbopack dev hydration mismatch).
- Consume the NestJS API; do not connect directly to PostgreSQL.
- API base URL from `NEXT_PUBLIC_API_URL` in `frontend/.env.local` (default `http://localhost:3001/api/v1`).

## Theming

- Two themes (light/dark) via CSS custom properties in `src/app/globals.css`: `:root` = light, `.dark` overrides.
- Theme state lives in `src/lib/context/theme-context.ts` + `theme-provider.tsx`. The provider toggles the `dark` class on `<html>` and persists to `localStorage`. Components read it with `useTheme()` from `theme-context`.
- `src/app/layout.tsx` has an inline anti-flash script (first element of `<body>`) that sets `.dark` before paint, and `<html lang="es" suppressHydrationWarning>` because the theme class is applied outside React.
- Palette: black/dark purple in dark mode, light lavender in light mode, pink (`--accent`) for details, purple (`--primary`) for accents.

## API client

- All requests go through `src/lib/api/client.ts` (`api.*` functions, fetch-based, no axios) with types in `src/lib/api/types.ts`.
- The client throws `ApiError` (message + HTTP status + body). Network failure → status `0`, message "No se pudo conectar con el servidor."
- Money values from Prisma arrive as **strings** (Decimal serialization). Type them as `string`, format with `Intl.NumberFormat` and render with `var(--font-mono)`.
- The backend must be running for data: `docker compose up -d` + `pnpm start:dev` in `backend/`. CORS is enabled only for `http://localhost:3000`.

## Integration

- Keep API calls in shared frontend client utilities rather than scattering raw requests across components.
- Treat backend responses as the source of truth.
- Show API validation and network errors explicitly (the client does this via `ApiError`).
- Data fetching pattern: `useEffect` with an async `load()` and a `cancelled` flag (cleanup sets `cancelled = true`) to discard stale responses on filter change or unmount.

## Components

- `src/components/`: `Sidebar` (desktop nav, ≥768px), `MobileNav` (top bar + bottom nav, <768px), `Card` (reusable panel with optional `title`).
- Reusable UI goes in `src/components/`; non-UI code in `src/lib/` (api, context, utils).

## Testing

Test form validation, filters, loading/error states, dashboard calculations displayed by the UI, and the main create-expense flow. Do not require exhaustive tests for purely visual details.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
