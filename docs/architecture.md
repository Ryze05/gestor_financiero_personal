# Arquitectura de Finanzas Personales

## 1. Objetivo

La aplicacion tendra dos clientes independientes para la misma API:

- Una aplicacion web para gestionar y consultar gastos.
- OpenClaw, que interpretara tickets y realizara consultas mediante lenguaje natural.

NestJS sera la unica capa autorizada para aplicar reglas de negocio y escribir en PostgreSQL. Ni Next.js ni OpenClaw accederan directamente a la base de datos.

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
| interpretacion    |   | API y dominio     |   | Docker           |
+-------------------+   +-------------------+   +------------------+
```

## 2. Tecnologias

### Frontend

- Next.js con App Router.
- React y TypeScript.
- CSS Modules para estilos encapsulados por componente.
- Recharts para el grafico de gastos por categoria.
- React Hook Form y Zod para formularios.
- Cliente HTTP basado en `fetch`.

### Backend

- NestJS con TypeScript.
- Prisma como ORM.
- PostgreSQL como base de datos.
- `class-validator` y `class-transformer` para validar DTOs.
- Swagger para documentar la API.
- Jest y Supertest para tests.

### Infraestructura

- Docker Compose para PostgreSQL.
- Node.js LTS.
- npm como gestor inicial de paquetes.
- Variables de entorno mediante archivos `.env` no versionados.

## 3. Estructura del repositorio

```text
finanzas_personales/
├── backend/
│   ├── prisma/
│   │   ├── migrations/
│   │   ├── seed.ts
│   │   └── schema.prisma
│   ├── src/
│   │   ├── dashboard/
│   │   ├── transactions/
│   │   ├── categories/
│   │   ├── accounts/
│   │   ├── prisma/
│   │   ├── app.module.ts
│   │   └── main.ts
│   ├── test/
│   ├── .env.example
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   ├── components/
│   │   ├── lib/
│   │   └── types/
│   ├── .env.example
│   └── package.json
├── openclaw/
│   ├── SKILL.md
│   └── ejemplos/
├── docs/
│   ├── specs.md
│   └── architecture.md
├── docker-compose.yml
├── .gitignore
└── README.md
```

## 4. Modelo de datos inicial

### Account

Representa una cuenta o medio de pago. El MVP tendra una cuenta inicial, pero el modelo permitira mas de una en el futuro.

- `id`: UUID.
- `name`: nombre unico.
- `initialBalance`: saldo inicial.
- `currency`: moneda de la cuenta, `EUR` o `USD`.
- `isArchived`: indica si se puede usar en nuevos movimientos.
- `createdAt` y `updatedAt`.

El saldo actual (`currentBalance`) se calculara a partir del saldo inicial y de los movimientos. Se incluira en las respuestas de la API, pero no se almacenara como columna independiente para evitar inconsistencias.

### Category

Clasifica los movimientos.

- `id`: UUID.
- `name`: nombre unico.
- `type`: `INCOME`, `EXPENSE` o `BOTH`.
- `color`: color hexadecimal opcional.
- `isArchived`.
- `createdAt` y `updatedAt`.

### Transaction

Representa un ingreso o gasto.

- `id`: UUID.
- `type`: `INCOME` o `EXPENSE`.
- `amount`: importe positivo con precision decimal.
- `currency`: moneda original del movimiento, `EUR` o `USD`.
- `accountAmount`: importe convertido a la moneda de la cuenta.
- `exchangeRate`: tasa aplicada; `1` cuando ambas monedas coinciden.
- `concept`: concepto del movimiento.
- `date`: fecha del movimiento.
- `notes`: texto opcional.
- `source`: origen del movimiento, `WEB` u `OPENCLAW` en el MVP.
- `externalId`: identificador de la operacion externa. Es obligatorio cuando `source` es `OPENCLAW` y no se utiliza para movimientos creados desde la web.
- `transferId`: referencia opcional a una transferencia. Los movimientos con este campo no cuentan como ingresos o gastos del dashboard.
- `accountId`: cuenta asociada.
- `categoryId`: categoria asociada.
- `createdAt` y `updatedAt`.

Los importes no se representaran con `number` en la logica de negocio del backend. Prisma utilizara `Decimal` para evitar errores de precision monetaria. El saldo de una cuenta se calculara usando `accountAmount`, conservando el importe original y la tasa aplicada para auditoria.

Las transferencias entre cuentas no se representaran como un gasto o ingreso normal. Se modelaran mediante la entidad `Transfer` y generaran dos movimientos vinculados dentro de una unica transaccion de base de datos:

- movimiento de salida en la cuenta origen;
- movimiento de entrada en la cuenta destino.

Ambos movimientos tendran el mismo `transferId` y quedaran excluidos de los totales de ingresos y gastos. Si las cuentas tienen monedas distintas, se aplicara un tipo de cambio al movimiento de entrada y se conservaran la tasa y los importes originales.

### Transfer

- `id`: UUID.
- `amount`: importe enviado en la moneda de la cuenta origen.
- `sourceCurrency`: moneda de la cuenta origen.
- `destinationAmount`: importe recibido en la moneda de destino.
- `destinationCurrency`: moneda de la cuenta destino.
- `exchangeRate`: tasa aplicada; `1` si coinciden las monedas.
- `date`: fecha de la transferencia.
- `concept`: concepto opcional.
- `sourceAccountId`: cuenta origen.
- `destinationAccountId`: cuenta destino.
- `createdAt` y `updatedAt`.

### Receipt (Nivel 2, ampliacion)

Agrupa los movimientos generados por un mismo ticket cuando OpenClaw los divide por categoria.

- `id`: UUID.
- `externalId`: identificador determinista del ticket para idempotencia.
- `merchant`: comercio opcional.
- `date`: fecha del ticket.
- `total`: importe total del ticket.
- `currency`: moneda del ticket.
- `accountId`: cuenta asociada.
- `source`: `WEB` u `OPENCLAW`.
- `createdAt` y `updatedAt`.

`Transaction` recibira un `receiptId` opcional que apunta a `Receipt`. Un ticket agrupara 1..N movimientos, uno por categoria. El nivel 1 no usa esta entidad: un ticket es un unico movimiento.

### LineItem (Nivel 3, post-MVP)

Almacena las lineas de producto de un ticket, cada una con importe y categoria. Queda fuera del alcance actual.

## 5. API REST

La API se servira desde NestJS con prefijo global `/api/v1`.

### Salud

- `GET /api/v1/health`

### Movimientos

- `GET /api/v1/transactions`
- `POST /api/v1/transactions`
- `GET /api/v1/transactions/:id`
- `PATCH /api/v1/transactions/:id`
- `DELETE /api/v1/transactions/:id`

### Transferencias

- `POST /api/v1/transfers`
- `GET /api/v1/transfers`
- `GET /api/v1/transfers/:id`

Parametros de `GET /api/v1/transactions` en el MVP:

- `from`: fecha inicial opcional.
- `to`: fecha final opcional.
- `categoryId`: categoria opcional.
- `type`: `INCOME` o `EXPENSE` opcional.
- `search`: busqueda opcional por concepto.
- `page` y `limit` para paginacion.

### Categorias

- `GET /api/v1/categories`
- `POST /api/v1/categories`
- `PATCH /api/v1/categories/:id`
- `DELETE /api/v1/categories/:id`

El borrado sera un archivado logico si la categoria tiene movimientos asociados.

### Cuentas

- `GET /api/v1/accounts`
- `POST /api/v1/accounts`
- `GET /api/v1/accounts/:id`
- `PATCH /api/v1/accounts/:id`

El seed creara una cuenta inicial para poder probar la aplicacion, pero la API y el frontend permitiran crear mas cuentas. Cada cuenta tendra su propia moneda (`EUR` o `USD`) y sus movimientos no se mezclaran con los de otras cuentas al calcular saldos.

### Dashboard

- `GET /api/v1/dashboard?from=YYYY-MM-DD&to=YYYY-MM-DD`

La respuesta incluira ingresos, gastos, balance, numero de movimientos y agrupaciones por categoria.

Los movimientos pueden recibirse en una moneda distinta a la de su cuenta. El MVP permitira `EUR` y `USD`; los balances se calcularan en la moneda de cada cuenta despues de convertir cada movimiento.

### Conversion de movimientos

Cuando un movimiento llegue en una moneda distinta a la de su cuenta, NestJS consultara una API publica de tipos de cambio, por ejemplo Frankfurter, y realizara la conversion antes de guardarlo.

- El importe persistido conserva su moneda original.
- El importe convertido se guarda en la moneda de la cuenta.
- El saldo de la cuenta usa el importe convertido.
- La API de tipos de cambio se consultara desde el backend, no desde el navegador.
- La tasa utilizada y su fecha se mostraran junto al equivalente.
- Si el servicio externo no esta disponible, se rechazara el alta que necesite conversion y se podra reintentar.
- Las tasas no se hardcodearan como si fueran actuales.

## 6. Contrato de creacion de gastos

`POST /api/v1/transactions` recibira un objeto como este:

```json
{
  "type": "EXPENSE",
  "amount": "23.40",
  "currency": "USD",
  "concept": "Compra en supermercado",
  "date": "2026-09-25",
  "categoryId": "categoria-alimentacion",
  "accountId": "cuenta-principal",
  "source": "OPENCLAW",
  "externalId": "ticket-20260925-001"
}
```

El backend validara todos los campos, comprobara que categoria y cuenta existen y rechazara categorias archivadas. Si la moneda del movimiento es distinta a la de la cuenta, calculara `accountAmount` consultando el tipo de cambio. La respuesta devolvera el movimiento persistido, incluido su `id`, la tasa aplicada y el importe convertido.

## 6.1. Contrato de transferencia

`POST /api/v1/transfers` recibira un objeto como este:

```json
{
  "amount": "500.00",
  "date": "2026-09-25",
  "sourceAccountId": "cuenta-eur",
  "destinationAccountId": "cuenta-usd",
  "concept": "Ahorro mensual"
}
```

La API comprobara que las cuentas son distintas y activas. La salida y la entrada se guardaran de forma atomica: si falla la conversion o cualquier validacion, no se guardara ninguna de las dos partes.

`externalId` permitira que OpenClaw reintente una peticion sin crear dos veces el mismo gasto. El identificador debe ser determinista para el mismo ticket u operacion. Si ya existe un movimiento OpenClaw con ese identificador, la API devolvera el movimiento existente o un conflicto claramente documentado.

## 7. Integracion con OpenClaw

OpenClaw utilizara una skill ubicada en `openclaw/SKILL.md`. La skill describira:

- La URL base de la API.
- Como consultar categorias.
- Como crear un gasto.
- Como listar movimientos.
- Como consultar el dashboard.
- Que campos debe extraer de un ticket.
- Que operaciones requieren confirmacion.
- Como actuar ante errores o respuestas perdidas.

### Extraccion de tickets

El modelo podra proponer:

```json
{
  "merchant": "Supermercado Ejemplo",
  "date": "2026-09-25",
  "amount": "23.40",
  "currency": "EUR",
  "categoryName": "Alimentacion",
  "concept": "Compra en supermercado",
  "confidence": 0.94
}
```

OpenClaw no llamara a `POST /api/v1/transactions` hasta que la persona confirme el resumen. Si falta un dato esencial, preguntara antes de enviar la operacion.

El backend no confiara en `confidence`, `merchant` ni en ningun dato generado por el modelo: todos los campos se validaran como una peticion normal.

## 8. Configuracion y ejecucion

### PostgreSQL

`docker-compose.yml` levantara un unico servicio PostgreSQL para desarrollo, con volumen persistente y credenciales definidas mediante variables de entorno.

Variables principales:

```text
POSTGRES_DB=finanzas
POSTGRES_USER=finanzas
POSTGRES_PASSWORD=finanzas_dev
DATABASE_URL=postgresql://finanzas:finanzas_dev@localhost:5432/finanzas
```

Estas credenciales son solo para desarrollo local y no deben reutilizarse en produccion.

### Puertos

- PostgreSQL: `5432`.
- pgAdmin: `5050`.
- NestJS: `3001`.
- Next.js: `3000`.

El frontend utilizara `NEXT_PUBLIC_API_URL=http://localhost:3001/api/v1`.

## 9. Seguridad del MVP

- El backend validara y transformara todos los DTOs.
- CORS permitira solamente el origen local del frontend durante desarrollo.
- No habra autenticacion multiusuario en el MVP.
- Las credenciales y URLs se configuraran mediante `.env`.
- No se guardaran imagenes de tickets en la primera version.
- No se incluiran secretos en el repositorio.

La ausencia de autenticacion es aceptable unicamente porque el proyecto se ejecutara localmente y para una sola persona. No se debe publicar la API directamente en Internet con esta configuracion.

## 10. Orden de implementacion

El trabajo se organiza en rebanadas verticales (backend + frontend + OpenClaw) segun `docs/specs.md` (seccion 1.3).

### Rebanada 1: nucleo backend

- Configurar Prisma (hecho), migracion (hecho) y seed (hecho).
- Implementar `PrismaService` y `PrismaModule` (hecho).
- Configurar `ValidationPipe` global y prefijo `/api/v1` (hecho).
- Implementar `health`, `accounts`, `categories` y `transactions`.
- TDD de reglas de negocio y validaciones.
- Añadir Swagger.

### Rebanada 2: frontend usable (Nivel 1)

- Crear proyecto Next.js con CSS Modules.
- Implementar layout, dashboard, listado y filtros.
- Implementar formulario de alta, edicion y borrado.
- Mostrar estados de carga y errores.

### Rebanada 3: OpenClaw (Nivel 1)

- Crear `openclaw/SKILL.md`.
- Documentar el contrato de la API.
- Probar consultas de gastos.
- Probar extraccion de ticket.
- Añadir confirmacion antes de registrar.
- Probar reintentos y evitar duplicados con `externalId`.

### Rebanada 4: extras financieros

- Conversion EUR/USD.
- Transferencias entre cuentas.

### Rebanada 5: Nivel 2 (si el tiempo lo permite)

- Entidad `Receipt` y `receiptId` en `Transaction`.
- Agrupacion de movimientos por categoria.
- Ajustar la skill de OpenClaw para proponer el desglose.

### Post-MVP: Nivel 3

- Entidad `LineItem` para lineas de producto.
- Edicion y visualizacion de tickets itemizados.

### Entrega

- Completar tests.
- Probar el flujo completo desde Docker Compose.
- Revisar responsive del frontend.
- Actualizar README.
- Preparar una demostracion reproducible.

## 11. Criterio de arquitectura completada

La arquitectura se considerara implementada (Nivel 1) cuando una persona pueda:

1. Levantar PostgreSQL con Docker Compose.
2. Arrancar NestJS y Next.js.
3. Registrar un gasto desde la web.
4. Consultarlo y verlo en el dashboard.
5. Proporcionar un ticket a OpenClaw.
6. Confirmar los datos extraidos.
7. Ver el gasto creado por OpenClaw en la web.
8. Consultar el resumen del periodo desde OpenClaw.

El Nivel 2 se considerara completado cuando un ticket con varias categorias genere varios movimientos agrupados por un `Receipt`.
