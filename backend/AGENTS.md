# Backend Guide

## Commands

Run from `backend/`:

```bash
pnpm start:dev
pnpm run build
pnpm run lint
pnpm test
pnpm test -- path/to/file.spec.ts
pnpm test:e2e
pnpm prisma validate
pnpm prisma db seed
```

The project uses Vitest, not Jest. `pnpm test` runs `vitest run`; `pnpm test:e2e` uses `vitest.config.e2e.ts`.

## Environment

`backend/.env` is required by Prisma and NestJS. `prisma7.config.ts` loads it with `dotenv` and `dotenv-expand`; NestJS validates it through `src/config/env.validation.ts`.

```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=finanzas
DB_USER=finanzas
DB_PASSWORD=finanzas_dev
DATABASE_URL="postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}"
PORT=3001
```

## Prisma

- Prisma 7. `prisma/schema.prisma` is the source of truth.
- The generator is `prisma-client` with output `../src/generated/prisma` (gitignored). It must live inside `src` so `tsconfig.build.json` keeps `rootDir: src`. Import it from `src/prisma/prisma.service.ts` as `../generated/prisma/client.js`, and from `prisma/seed.ts` as `../src/generated/prisma/client.js`. Run `pnpm prisma generate` after schema changes.
- Prisma 7 requires a driver adapter: `new PrismaClient()` without one fails. Use `new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) })` from `@prisma/adapter-pg`.
- Use Prisma migrations for schema changes; do not edit tables manually in pgAdmin.
- Do not use `prisma db push` for normal development.
- Review important generated migrations before applying them.
- PostgreSQL is exposed at `localhost:5432`; pgAdmin is at `http://localhost:5050`.

After changing `schema.prisma`:

```bash
pnpm prisma validate
pnpm prisma migrate dev --name <descriptive_name>
pnpm prisma generate
```

## Seed

- Seed lives in `prisma/seed.ts` and is wired through `prisma7.config.ts` (`migrations.seed: "tsx prisma/seed.ts"`).
- Run it with `pnpm prisma db seed`. It is idempotent (uses `upsert` by unique `name`).
- The seed imports `dotenv/config` and creates the default EUR account plus the base categories.
- `tsx` is only needed to execute the TypeScript seed; the NestJS app is built with `nest build`.

## Repository Cleanup

`prisma init` installed agent-skill files in `backend/` (`.agents/`, `.claude/`, `.windsurf/`, `skills-lock.json`). They were unrelated to the NestJS app and have been removed.

## API Conventions

- `src/app.setup.ts` centralizes the `/api/v1` prefix, the global `ValidationPipe`, the `PrismaExceptionFilter` and Swagger. `main.ts` and the e2e tests both call `setupApp(app)`.
- `setupApp` also enables CORS for `http://localhost:3000` (the local Next.js frontend).
- Swagger UI: `http://localhost:3001/docs`; OpenAPI JSON at `/docs-json`.
- Global `ValidationPipe` uses `whitelist`, `forbidNonWhitelisted`, `transform` and `enableImplicitConversion`. DTOs must use `class-validator` decorators.
- List endpoints are paginated with `PaginationQueryDto` and return `{ data, total, page, limit }`.
- `PrismaExceptionFilter` maps `P2025` to 404, `P2002` to 409, anything else to 500.
- Money is handled with Prisma `Decimal`, never JavaScript `number`.
- `PrismaService`/`PrismaModule` are global; inject `PrismaService` to access the database.
- Implementation follows the vertical-slice roadmap in `docs/specs.md` (section 1.3) and `docs/architecture.md` (section 10).

## Domain Constraints

- Use Prisma `Decimal` for monetary values; do not use JavaScript `number` for financial calculations.
- Preserve original transaction amount/currency and converted account amount/rate.
- Transfers have their own entity and endpoints and do not count as income or expense in dashboard totals.
- `source` is `WEB` or `OPENCLAW`.
- `externalId` provides idempotency for OpenClaw-created operations.
- `transfers` creates an atomic `Transfer` plus its EXPENSE/INCOME movement pair. Transfers support active accounts and EUR/USD conversion.
- Deleting a transfer cascades to its two linked transactions. Editing a transfer (`PATCH`) updates the transfer and its two linked transactions atomically.

## Testing

Unit tests are `*.spec.ts`; e2e tests are `*.e2e-spec.ts`. E2E tests use the real development database, disable file parallelism (`fileParallelism: false` in `vitest.config.e2e.ts`) so files do not interfere, and each file cleans up the rows it creates (often by an `e2e-` name prefix) in `afterAll`.

Use guided TDD for domain rules: failing test, minimum implementation, passing test, then refactor. Prioritize money, currency conversion, transfers, dashboard totals, validation, and OpenClaw idempotency. Use integration tests for API endpoints; exhaustive TDD of visual details belongs to the frontend.

When finishing a backend change, run focused tests first, then `pnpm prisma validate` for Prisma changes, `pnpm run build` for backend changes, and lint when relevant. Report checks that could not run.
