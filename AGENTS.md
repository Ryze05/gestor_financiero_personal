# Repository Guide

## Layout

- `backend/`: NestJS API and Prisma persistence.
- `frontend/`: Next.js web application.
- `openclaw/`: placeholder for OpenClaw integration (empty; only `.gitkeep`).
- `docs/`: product spec and architecture decisions (written in Spanish).
- `docker-compose.yml`: local PostgreSQL and pgAdmin services.

`backend/` and `frontend/` are independent pnpm projects, not a pnpm workspace: each has its own `package.json`, `pnpm-lock.yaml`, and `pnpm-workspace.yaml`, and there is no root `package.json`. Run package commands from inside `backend/` or `frontend/`.

This is a single git repository (branch `main`). `.gitignore` rules are split across the root, `backend/`, and `frontend/`; generated artifacts (`dist/`, `backend/src/generated/prisma`, `*.tsbuildinfo`) and `.env` files must stay untracked.

## Local Development

1. Start the database: `docker compose up -d` (PostgreSQL on `5432`, pgAdmin on `5050`).
2. Backend: `pnpm start:dev` from `backend/` (API on `3001`, Swagger at `/docs`).
3. Frontend: `pnpm dev` from `frontend/` (`http://localhost:3000`, consumes `http://localhost:3001/api/v1`).

## Workflow

- Use `pnpm`, not `npm`.
- `frontend/` has no test script (`pnpm test` does not exist there); verify with `pnpm lint` and `pnpm build`. `backend/` uses Vitest.
- Ask for approval before installing dependencies, running mutating commands, or creating, editing, or deleting files.
- Keep changes small and verify the affected package.
- Do not overwrite user changes.
- Commit messages use Conventional Commits with a scope (`feat(backend):`, `feat(frontend):`, `docs:`, etc.).

## Shared Domain Rules

- Supported currencies are `EUR` and `USD`.
- The backend API is the only write path to PostgreSQL.
- OpenClaw must obtain human confirmation before creating a ticket-derived expense.
- Never commit `.env` files, credentials, or database volumes.

Package-specific instructions (commands, Prisma 7 quirks, testing) live in `backend/AGENTS.md` and `frontend/AGENTS.md`.
