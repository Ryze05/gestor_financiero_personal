# Finanzas Personales

Aplicación web para registrar y consultar ingresos y gastos personales: balance mensual, gasto por categoría, transferencias entre cuentas (con conversión EUR/USD) y agrupación de movimientos por ticket.

El proyecto tiene dos clientes sobre una misma API: una **interfaz web** (Next.js) y **OpenClaw** (vía un servidor MCP) que interpreta tickets y responde en lenguaje natural. El backend NestJS es la única capa que aplica reglas de negocio y escribe en PostgreSQL.

```text
                    +-------------------+
                    |     Next.js       |
                    |    interfaz web   |
                    +---------+---------+
                              |
                              | HTTP/REST
                              v
+-------------------+   +----+--------------+   +------------------+
| OpenClaw + modelo |-->|     NestJS        |-->| PostgreSQL       |
| (servidor MCP)    |   | API y dominio     |   | Docker           |
+-------------------+   +-------------------+   +------------------+
```

## Stack

| Capa | Tecnologías |
|---|---|
| Frontend | Next.js 16 (App Router), React 19, TypeScript, CSS Modules, Radix UI, Recharts |
| Backend | NestJS 12, Prisma 7, PostgreSQL 16, class-validator, Swagger, Vitest |
| MCP | `@modelcontextprotocol/server`, Zod, cliente HTTP de la API |
| Infra | Docker Compose (PostgreSQL + pgAdmin), pnpm |

## Funcionalidades

- Dashboard con saldo actual (all-time), resumen del mes, gráfico por categoría y evolución temporal.
- Alta, edición y borrado de movimientos (ingresos y gastos) con filtros por fecha, tipo, cuenta, categoría, origen, importe y texto.
- Transferencias entre cuentas con conversión EUR/USD y movimientos vinculados.
- Tickets (Nivel 2): un ticket agrupa varios movimientos por categoría mediante la entidad `Receipt`.
- Gestión de cuentas y categorías (crear, editar y archivar).
- Aviso de saldo negativo (permite negativos, avisa en el frontend).
- Servidor MCP que expone la API como tools para OpenClaw, con confirmación humana antes de escribir.

## Estructura del repositorio

```text
finanzas_personales/
├── backend/     API NestJS + Prisma (única capa de escritura en PostgreSQL)
├── frontend/    Aplicación web Next.js
├── mcp/         Servidor MCP que expone la API como tools
├── docs/        Especificación (specs.md) y arquitectura (architecture.md)
└── docker-compose.yml
```

`backend/`, `frontend/` y `mcp/` son proyectos pnpm independientes (cada uno con su propio `package.json` y `pnpm-lock.yaml`); no hay workspace raíz.

## Requisitos

- Node.js LTS y `pnpm`.
- Docker y Docker Compose.

## Puesta en marcha

### 1. Base de datos

```bash
docker compose up -d
```

- PostgreSQL en `localhost:5432`.
- pgAdmin en `http://localhost:5050`.

### 2. Backend

```bash
cd backend
pnpm install
cp .env.example .env
pnpm prisma migrate dev
pnpm prisma generate
pnpm prisma db seed
pnpm start:dev
```

La API queda en `http://localhost:3001/api/v1` y Swagger en `http://localhost:3001/docs`.

`backend/.env` (no versionado):

```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=finanzas
DB_USER=finanzas
DB_PASSWORD=finanzas_dev
DATABASE_URL="postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}"
PORT=3001
```

### 3. Frontend

```bash
cd frontend
pnpm install
cp .env.example .env
pnpm dev
```

Disponible en `http://localhost:3000`. Usa `NEXT_PUBLIC_API_URL` de `frontend/.env` (por defecto `http://localhost:3001/api/v1`).

### 4. Servidor MCP (opcional)

```bash
cd mcp
pnpm install
pnpm start
```

Es un cliente HTTP de la API (`FINANZAS_API_URL`, por defecto `http://localhost:3001/api/v1`); no accede a PostgreSQL. Ver `mcp/README.md` para registrar los tools en un host MCP.

## Comandos

| Directorio | Comando | Descripción |
|---|---|---|
| `backend/` | `pnpm start:dev` | API en modo watch |
| `backend/` | `pnpm build` | Compilar |
| `backend/` | `pnpm test` / `pnpm test:e2e` | Tests unitarios / e2e (Vitest) |
| `backend/` | `pnpm lint` | Lint con oxlint |
| `frontend/` | `pnpm dev` / `pnpm build` | Desarrollo / build |
| `frontend/` | `pnpm lint` | Lint con ESLint |
| `mcp/` | `pnpm start` / `pnpm typecheck` | Servidor MCP / typecheck |

## API REST (resumen)

Prefijo global `/api/v1`:

- `GET /health`
- `GET|POST /transactions`, `GET|PATCH|DELETE /transactions/:id`
- `GET|POST /transfers`, `GET|DELETE /transfers/:id`
- `GET|POST /receipts`, `GET|DELETE /receipts/:id`
- `GET /activities`
- `GET|POST /categories`, `GET|PATCH|DELETE /categories/:id`, `PATCH /categories/:id/restore`
- `GET|POST /accounts`, `GET|PATCH|DELETE /accounts/:id`, `PATCH /accounts/:id/restore`
- `GET /dashboard`
- `GET /exchange/rate`

Los listados devuelven `{ data, total, page, limit }`. Los importes son `Decimal` y viajan como string. Más detalle en `docs/architecture.md`.

## Documentación

- `docs/specs.md` — objetivo, alcance del MVP, casos de uso y reglas de negocio.
- `docs/architecture.md` — modelo de datos, contrato de la API e integración con OpenClaw.
- `backend/AGENTS.md`, `frontend/AGENTS.md` — convenciones y comandos por paquete.

## Seguridad

El MVP no tiene autenticación multiusuario y está pensado para ejecutarse en local. No debe publicarse la API directamente en Internet con esta configuración. Las credenciales de desarrollo y los archivos `.env` no se versionan.
