# Repository Guide

## Layout

- `backend/`: NestJS API and Prisma persistence.
- `frontend/`: Next.js web application.
- `openclaw/`: OpenClaw skill and API examples.
- `docs/`: product specification and architecture decisions.
- `docker-compose.yml`: local PostgreSQL and pgAdmin services.

This is a single git repository (branch `main`) containing the whole monorepo. Generated artifacts (`dist/`, `src/generated/prisma`, `*.tsbuildinfo`) and `.env` files must stay untracked.

## Workflow

- Use `pnpm`, not `npm`.
- Ask for approval before installing dependencies, running mutating commands, or creating, editing, or deleting files.
- Keep changes small and verify the affected package.
- Do not overwrite user changes.

## Shared Domain Rules

- Supported currencies are `EUR` and `USD`.
- The backend API is the only write path to PostgreSQL.
- OpenClaw must obtain human confirmation before creating a ticket-derived expense.
- Never commit `.env` files, credentials, or database volumes.

Package-specific instructions live in `backend/AGENTS.md` and `frontend/AGENTS.md`.
