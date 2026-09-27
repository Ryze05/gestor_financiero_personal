# Frontend Guide

## Stack

- Next.js 16 (App Router) with React and TypeScript.
- CSS Modules for component styles; do not introduce Tailwind for this project.
- Consume the NestJS API; do not connect directly to PostgreSQL.
- API base URL from `NEXT_PUBLIC_API_URL` (default `http://localhost:3001/api/v1`).

## Integration

- Keep API calls in shared frontend client utilities rather than scattering raw requests across components.
- Treat backend responses as the source of truth.
- Show API validation and network errors explicitly.

## Testing

Test form validation, filters, loading/error states, dashboard calculations displayed by the UI, and the main create-expense flow. Do not require exhaustive tests for purely visual details.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
