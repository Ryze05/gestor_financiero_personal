# Backend — Finanzas Personales

API REST en NestJS y persistencia con Prisma 7 sobre PostgreSQL. Es la única capa autorizada para aplicar reglas de negocio y escribir en la base de datos; ni el frontend ni el servidor MCP acceden directamente a PostgreSQL.

## Stack

- NestJS 12 con TypeScript.
- Prisma 7 (`prisma-client`) + `@prisma/adapter-pg`.
- PostgreSQL 16.
- `class-validator` / `class-transformer` para DTOs.
- Swagger para la documentación OpenAPI.
- Vitest y Supertest para tests.

## Requisitos

- Node.js LTS y `pnpm`.
- PostgreSQL en marcha (`docker compose up -d` desde la raíz).

## Configuración

Copia `backend/.env.example` a `backend/.env` (no versionado). Es necesario para Prisma y NestJS:

```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=finanzas
DB_USER=finanzas
DB_PASSWORD=finanzas_dev
DATABASE_URL="postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}"
PORT=3001
```

`prisma7.config.ts` carga el archivo con `dotenv` + `dotenv-expand`; NestJS valida las variables mediante `src/config/env.validation.ts`.

## Puesta en marcha

```bash
pnpm install
pnpm prisma migrate dev
pnpm prisma generate
pnpm prisma db seed
pnpm start:dev
```

- API: `http://localhost:3001/api/v1`
- Swagger UI: `http://localhost:3001/docs`
- OpenAPI JSON: `http://localhost:3001/docs-json`

## Comandos

```bash
pnpm start:dev        # API en modo watch
pnpm build            # Compilar
pnpm start:prod       # Ejecutar el build
pnpm run lint         # oxlint (no ESLint)
pnpm test             # Tests unitarios (Vitest)
pnpm test -- path/to/file.spec.ts
pnpm test:e2e         # Tests e2e (base de datos de desarrollo real)
pnpm test:cov         # Cobertura
pnpm prisma validate
pnpm prisma db seed
```

## Prisma

- `prisma/schema.prisma` es la fuente de verdad.
- El generador `prisma-client` escribe en `../src/generated/prisma` (gitignoreado). Se importa desde `src/prisma/prisma.service.ts` como `../generated/prisma/client.js` y desde `prisma/seed.ts` como `../src/generated/prisma/client.js`.
- Prisma 7 exige un driver adapter: `new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) })`.
- Usa migraciones para los cambios de esquema; no edites tablas a mano en pgAdmin ni uses `db push` en desarrollo.

Tras cambiar `schema.prisma`:

```bash
pnpm prisma validate
pnpm prisma migrate dev --name <nombre_descriptivo>
pnpm prisma generate
```

## Seed

`prisma/seed.ts` (ejecutado por `tsx`) es idempotente y crea dos cuentas (`Cuenta principal` en EUR y `Revolut` en USD) y el catálogo base de categorías de gasto, ingreso y `BOTH`. Se ejecuta con `pnpm prisma db seed`.

## Módulos

| Módulo | Responsabilidad |
|---|---|
| `health` | `GET /health` |
| `categories` | CRUD + archivar/restaurar y paginación |
| `accounts` | CRUD + archivar/restaurar; expone `currentBalance` |
| `transactions` | CRUD, filtros, paginación, idempotencia por `externalId` y borrado real |
| `transfers` | Alta/listado/edición/borrado atómico de transferencias y sus movimientos vinculados |
| `receipts` | Tickets (Nivel 2): alta atómica e idempotente de un `Receipt` con sus movimientos |
| `activities` | Vista de usuario: tickets agrupados y movimientos sueltos, paginada por compras |
| `dashboard` | Resumen por periodo y cuenta (`income`, `expense`, `balance`, `byCategory`, `timeline`) |
| `exchange-rate` | `GET /exchange/rate`; conversión EUR/USD en el backend |
| `prisma` | `PrismaService` / `PrismaModule` globales |
| `common` | `PaginationQueryDto`, filtros, transformaciones y `PrismaExceptionFilter` |
| `config` | Validación de variables de entorno |

## API

Prefijo global `/api/v1`:

- `GET /health`
- `GET|POST /transactions`, `GET|PATCH|DELETE /transactions/:id`
- `GET|POST /transfers`, `GET|GET :id|DELETE :id`
- `GET|POST /receipts`, `GET /receipts/:id`, `DELETE /receipts/:id`
- `GET /activities`
- `GET|POST /categories`, `GET|PATCH|DELETE /categories/:id`, `PATCH /categories/:id/restore`
- `GET|POST /accounts`, `GET|PATCH|DELETE /accounts/:id`, `PATCH /accounts/:id/restore`
- `GET /dashboard?accountId=&from=&to=`
- `GET /exchange/rate`

Detalles de contratos, campos y códigos de error en `../docs/architecture.md`.

### Convenciones

- `setupApp` (`src/app.setup.ts`) centraliza el prefijo `/api/v1`, el `ValidationPipe` global (`whitelist`, `forbidNonWhitelisted`, `transform`, conversión implícita), CORS para `http://localhost:3000`, el `PrismaExceptionFilter` y Swagger.
- Los listados son paginados con `PaginationQueryDto` y devuelven `{ data, total, page, limit }`.
- `PrismaExceptionFilter` traduce `P2025` → 404, `P2002` → 409 y cualquier otro error → 500.
- Los valores monetarios usan `Decimal` de Prisma, nunca `number` de JavaScript, y se serializan como string.
- Los `:id` se validan con `ParseUUIDPipe` (400 si el formato es inválido).
- `source` es `WEB` u `OPENCLAW`; `externalId` da idempotencia a las operaciones de OpenClaw.

## Reglas de dominio

- La moneda de un movimiento puede diferir de la de su cuenta: se conservan `amount`/`currency` originales y se calculan `accountAmount` y `exchangeRate`.
- Las transferencias tienen entidad propia y generan dos movimientos vinculados (salida/entrada) de forma atómica; cuentan como gasto/ingreso en saldos y dashboard.
- Borrar una transferencia elimina en cascada sus dos movimientos; editarla (`PATCH`) actualiza transferencia y movimientos atómicamente.
- Un `Receipt` agrupa líneas por categoría; no altera saldos ni dashboard.
- El backend permite saldos negativos (el frontend avisa).

## Tests

- Unitarios: `*.spec.ts`. E2E: `*.e2e-spec.ts`.
- Los e2e usan la base de datos de desarrollo real, desactivan el paralelismo de archivos y limpian las filas que crean en `afterAll`.
- Al terminar un cambio: tests focalizados, `pnpm prisma validate` (si toca Prisma), `pnpm build` y lint cuando aplique.

## Convenciones adicionales

Ver `AGENTS.md` en este directorio para las convenciones de trabajo del paquete.
