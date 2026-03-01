# Mintymon

## Database Management

- **Always use incremental migrations** (`pnpm db:generate` then `pnpm db:migrate`), never `db:push`, except on dev branches where `db:push` is acceptable for rapid iteration.
- Production database is on Neon, project ID `dry-violet-37248712`.
- Two branches: `production` (main/default) and `dev` (child of production).
- To run migrations against prod: get the connection string via Neon MCP (`get_connection_string`), then pass it as `DATABASE_URL` to `pnpm db:migrate`.
- After migrating prod, reset the dev branch from parent via Neon MCP (`reset_from_parent`, branch `br-empty-mode-ag0l4rtn`) so dev picks up the new schema.
- `drizzle-kit` does not auto-load `.env.local` — pass `DATABASE_URL` explicitly when targeting a specific environment.
- Schema files: `lib/db/schema.ts` (app tables), `lib/db/auth-schema.ts` (Better Auth tables). Both are referenced in `drizzle.config.ts`.
- Schema files have `import 'server-only'`. Temporarily remove these when running `npx auth@latest generate` or if `drizzle-kit generate` fails, then add them back.

## Auth

- Uses Better Auth with database-backed rate limiting and sessions.
- Auth config: `lib/auth.ts`. Client: `lib/auth-client.ts`.
- Single admin user, signup disabled. Seed admin via `pnpm db:seed-admin` (requires `ADMIN_EMAIL` and `ADMIN_PASSWORD` env vars).
- Env vars: `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`.
