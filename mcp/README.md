# Finanzas MCP Server

Servidor MCP que expone la API REST de Finanzas Personales (`backend/`) como tools para OpenClaw (u otro host MCP). Consulta y registra movimientos y transferencias en lenguaje natural.

No accede a PostgreSQL: es un cliente HTTP de la REST API en `http://localhost:3001/api/v1`. Por eso el CORS no aplica (solo afecta a navegadores).

## Requisitos

- `backend/` levantado (`docker compose up -d` + `pnpm start:dev` desde `backend/`).
- Opcional: `FINANZAS_API_URL` en `mcp/.env` (ver `.env.example`). Default: `http://localhost:3001/api/v1`.

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
| `list_transactions` | `GET /transactions` | no |
| `list_transfers` | `GET /transfers` | no |
| `get_dashboard` | `GET /dashboard` | no |
| `create_transaction` | `POST /transactions` | **sí** |
| `create_transfer` | `POST /transfers` | **sí** |

## Confirmación humana

`create_transaction` y `create_transfer` se exponen para escritura, pero el host (OpenClaw) debe obtener confirmación explícita de la persona **antes** de invocarlos.

- `create_transaction` fuerza `source: "OPENCLAW"` y usa `externalId` determinista (`ticket-...`) para ser idempotente: si ya existe, devuelve el movimiento sin duplicar.
- `create_transfer` mueve entre dos cuentas distintas y activas; la conversión entre monedas la calcula el backend según la moneda de cada cuenta.

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

Detalles de la integración en `docs/architecture.md` (sección 7) y `docs/specs.md` (sección 5.1).