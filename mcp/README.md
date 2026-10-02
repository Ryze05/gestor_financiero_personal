# Finanzas MCP Server

Servidor MCP que expone la API REST de Finanzas Personales (`backend/`) como tools para OpenClaw (u otro host MCP). Permite consultar y registrar movimientos, transferencias y tickets en lenguaje natural.

No accede a PostgreSQL: es un cliente HTTP de la REST API en `http://localhost:3001/api/v1`. Por eso CORS no aplica (solo afecta a navegadores).

## Stack

- `@modelcontextprotocol/server` sobre stdio.
- Zod para validar los argumentos de cada tool.
- TypeScript ejecutado con `tsx` (no hay build).

## Requisitos

- `backend/` levantado (`docker compose up -d` + `pnpm start:dev` desde `backend/`).
- Opcional: `FINANZAS_API_URL` en `mcp/.env` (ver `.env.example`). Por defecto `http://localhost:3001/api/v1`.

## Instalación y ejecución

```bash
pnpm install
pnpm start
```

Scripts: `pnpm dev` (watch), `pnpm start`, `pnpm typecheck`.

## Tools

| Tool | Endpoint | Confirmación humana |
|---|---|---|
| `list_categories` | `GET /categories?limit=100` | no |
| `list_accounts` | `GET /accounts?limit=100` | no |
| `list_activities` | `GET /activities` | no |
| `list_transfers` | `GET /transfers` | no |
| `get_dashboard` | `GET /dashboard` | no |
| `get_rate` | `GET /exchange/rate` | no |
| `create_transaction` | `POST /transactions` | **sí** |
| `create_transfer` | `POST /transfers` | **sí** |
| `create_receipt` | `POST /receipts` | **sí** |

- `list_activities` agrupa tickets (compra con comercio, total y líneas dentro) y movimientos sueltos; `accountId` es obligatorio y admite filtros de fecha, categoría, tipo, texto, importe y `onlyReceipts`.
- `get_dashboard` requiere `accountId` y acepta `from`/`to`.
- `get_rate` requiere las monedas `from` y `to` (`EUR`/`USD`).

## Confirmación humana

`create_transaction`, `create_transfer` y `create_receipt` se exponen para escritura, pero el host (OpenClaw) debe obtener confirmación explícita de la persona **antes** de invocarlos.

- `create_transaction` fuerza `source: "OPENCLAW"` y usa `externalId` determinista (`ticket-...`) para ser idempotente: si ya existe, devuelve el movimiento sin duplicar.
- `create_transfer` mueve entre dos cuentas distintas y activas; la conversión entre monedas la calcula el backend según la moneda de cada cuenta.
- `create_receipt` registra un ticket con varias líneas (cada línea es un producto con su concepto, importe y categoría) y también es idempotente por `externalId`.

## Registrar en un host MCP

```json
{
  "mcpServers": {
    "finanzas": {
      "command": "pnpm",
      "args": ["--dir", "/ruta/a/finanzas_personales/mcp", "start"],
      "env": {
        "FINANZAS_API_URL": "http://localhost:3001/api/v1"
      }
    }
  }
}
```

Detalles de la integración en `../docs/architecture.md` (sección 7) y `../docs/specs.md` (sección 5.1).
