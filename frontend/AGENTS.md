# Frontend Guide

## Stack

- Next.js with React and TypeScript.
- CSS Modules for component styles; do not introduce Tailwind for this project.
- Consume the NestJS API; do not connect directly to PostgreSQL.

## Testing

Test form validation, filters, loading/error states, dashboard calculations displayed by the UI, and the main create-expense flow. Do not require exhaustive tests for purely visual details.

## Integration

- Keep API calls in shared frontend client utilities rather than scattering raw requests across components.
- Treat backend responses as the source of truth.
- Show API validation and network errors explicitly.
