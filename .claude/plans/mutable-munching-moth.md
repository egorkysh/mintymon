# Replace hand-rolled auth with Better Auth

## Context

The current login system has a **critical vulnerability**: rate limiting uses an in-memory `Map` that resets on every Vercel cold start and isn't shared across serverless instances — making brute-force protection effectively non-existent in production. The window is also too short (60s / 5 attempts = 7,200 guesses/day).

Rather than patching the custom auth, we'll replace it with [Better Auth](https://better-auth.com) which provides **database-backed rate limiting** (persistent across cold starts), built-in session management, CSRF protection, IPv6 normalization, and proper password hashing — all battle-tested.

## Files to modify

| File | Action |
|------|--------|
| `lib/auth.ts` | **Rewrite** — Better Auth server instance |
| `lib/auth-client.ts` | **Create** — Better Auth client |
| `app/api/auth/[...all]/route.ts` | **Create** — catch-all route handler |
| `app/api/auth/login/route.ts` | **Delete** — replaced by catch-all |
| `app/api/auth/logout/route.ts` | **Delete** — replaced by catch-all |
| `proxy.ts` | **Rewrite** — use `auth.api.getSession` |
| `app/login/page.tsx` | **Rewrite** — use auth client, add email field |
| `components/layout/header.tsx` | **Update** — use `authClient.signOut()` |
| `lib/db/schema.ts` | **Update** — add Better Auth tables (user, session, account, verification, rateLimit) |
| `lib/db/seed-admin.ts` | **Create** — seed script for admin user |
| `.env.local.example` | **Update** — new env vars |
| `lib/__tests__/auth.test.ts` | **Rewrite** — tests for new auth module |
| `package.json` | **Update** — add `better-auth`, remove `bcryptjs`, `jose`, `@types/bcryptjs` |

## Implementation steps

### 1. Install / uninstall packages

```bash
pnpm add better-auth
pnpm remove bcryptjs jose @types/bcryptjs
```

### 2. Rewrite `lib/auth.ts` — Better Auth server instance

```ts
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { db } from "./db";

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg" }),
  emailAndPassword: {
    enabled: true,
    disableSignUp: true,      // single admin — no public registration
    maxPasswordLength: 128,
  },
  session: {
    expiresIn: 8 * 60 * 60,   // 8 hours (matches current behaviour)
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60,         // revalidate session from DB every 5 min
    },
  },
  rateLimit: {
    enabled: true,
    storage: "database",       // persistent across cold starts
    window: 60,
    max: 100,                  // global default
    customRules: {
      "/sign-in/email": {
        window: 60,
        max: 5,                // 5 login attempts per 60s
      },
    },
  },
  plugins: [nextCookies()],    // must be last
});
```

### 3. Create `lib/auth-client.ts`

```ts
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient();
```

### 4. Create `app/api/auth/[...all]/route.ts`

```ts
import { auth } from "@/lib/auth";
import { toNextJsHandler } from "better-auth/next-js";

export const { GET, POST } = toNextJsHandler(auth);
```

### 5. Delete old routes

Remove `app/api/auth/login/route.ts` and `app/api/auth/logout/route.ts`.

### 6. Rewrite `proxy.ts`

- Keep skip-list for login page, auth API, cron routes, static assets
- Keep CSRF origin check for non-auth mutating requests
- Replace JWT verification with `auth.api.getSession({ headers: await headers() })`
- Redirect to `/login` if no valid session

### 7. Update `app/login/page.tsx`

- Add email field (Better Auth requires email + password)
- Replace manual `fetch('/api/auth/login')` with `authClient.signIn.email({ email, password })`
- Handle 429 rate limit errors using `fetchOptions.onError`

### 8. Update `components/layout/header.tsx`

- Import `authClient` from `@/lib/auth-client`
- Replace `fetch('/api/auth/logout', { method: 'POST' })` with `authClient.signOut()`

### 9. Add Better Auth tables to `lib/db/schema.ts`

Run `npx auth@latest generate` to generate the schema additions, then integrate into `lib/db/schema.ts`. Tables needed:

- `user` (id, name, email, emailVerified, image, createdAt, updatedAt)
- `session` (id, userId, token, expiresAt, ipAddress, userAgent, createdAt, updatedAt)
- `account` (id, userId, accountId, providerId, accessToken, refreshToken, …)
- `verification` (id, identifier, value, expiresAt, createdAt, updatedAt)
- `rateLimit` (id, key, count, lastRequest)

Remove the `'server-only'` import from the top of schema.ts (Better Auth needs this schema at build/migration time too).

### 10. Run migrations

```bash
pnpm db:generate   # drizzle-kit generate
pnpm db:migrate    # drizzle-kit migrate
```

### 11. Create `lib/db/seed-admin.ts`

Script that uses `auth.api.signUpEmail` server-side to create the admin user. Server-side API calls bypass `disableSignUp` and rate limiting.

```bash
# Usage:
ADMIN_EMAIL=admin@example.com ADMIN_PASSWORD=<strong-password> pnpm db:seed-admin
```

Add `"db:seed-admin"` script to package.json.

### 12. Update `.env.local.example`

Remove:
- `ADMIN_PASSWORD_HASH`
- `ADMIN_SESSION_SECRET`
- `JWT_VERSION`

Add:
- `BETTER_AUTH_SECRET=...` (generate: `openssl rand -base64 32`)
- `BETTER_AUTH_URL=http://localhost:3000` (or production URL)

### 13. Rewrite `lib/__tests__/auth.test.ts`

Replace old unit tests (bcryptjs mocks, jose mocks, cookie assertions) with tests for the new `auth` instance — verify it exports correctly, rate limit config is set, etc.

### 14. Remove `server-only` mock if unused

Check if `lib/__tests__/server-only-mock.ts` is still needed after the rewrite.

## Environment variables

| Variable | Old | New |
|----------|-----|-----|
| `ADMIN_PASSWORD_HASH` | Required | **Removed** — password in DB |
| `ADMIN_SESSION_SECRET` | Required | **Removed** — replaced by `BETTER_AUTH_SECRET` |
| `JWT_VERSION` | Optional | **Removed** — Better Auth manages sessions |
| `BETTER_AUTH_SECRET` | — | **New** — 32+ char secret |
| `BETTER_AUTH_URL` | — | **New** — app base URL |

## Verification

1. `pnpm db:generate && pnpm db:migrate` — migrations apply cleanly
2. `ADMIN_EMAIL=... ADMIN_PASSWORD=... pnpm db:seed-admin` — admin user created
3. `pnpm dev` — app starts without errors
4. Visit `/login` — shows email + password form
5. Submit wrong credentials 6 times — get 429 rate limit response
6. Submit correct credentials — redirected to dashboard
7. Click logout — redirected to login
8. Visit dashboard without session — redirected to login
9. `pnpm test` — all tests pass
10. `pnpm build` — zero type errors
