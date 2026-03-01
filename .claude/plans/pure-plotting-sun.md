# Server Component Audit: Findings & Remediation Plan

## Context

This codebase (Mintymon — a Next.js 16 monitoring dashboard) marks **every component and every page** as `'use client'`. Out of ~28 component/page files, all 28 have the `'use client'` directive. This defeats a core benefit of the App Router: Server Components that reduce client JS bundle size, enable direct data fetching, and improve initial load performance.

The current architecture sends all UI code — including purely presentational components like `PageHeader`, `SectionGrid`, `StatusBadge`, and `WidgetSkeleton` — to the client bundle, along with heavy libraries like Recharts and date-fns that are only used in specific leaf components. None of the server-only modules (`lib/auth.ts`, `lib/db/queries.ts`) are protected with the `server-only` package, and no Server Actions are used despite having a natural fit for the alerts CRUD operations.

---

## Findings Summary

### Issue 1: `'use client'` placed too high — dashboard layout is a Client Component
- **File**: `app/(dashboard)/layout.tsx`
- The entire dashboard layout is `'use client'` to provide `QueryProvider` and `TimeRangeProvider`. This forces **every child** into the client bundle, including all pages and all imported components — even those that need zero interactivity.
- **Best practice**: Keep layouts as Server Components. Pass `{children}` through client-side context providers using the "donut pattern" — providers are Client Components that wrap a server-rendered `{children}` slot.
- **Current status**: Already using the donut pattern structurally (providers wrap `{children}`), but the layout itself is unnecessarily marked `'use client'`.

### Issue 2: Presentational components needlessly marked `'use client'`
These components have **no hooks, no state, no event handlers, no browser APIs** — they are pure render functions and should be Server Components:

| Component | File | Why it doesn't need `'use client'` |
|---|---|---|
| `PageHeader` | `components/layout/page-header.tsx` | Pure JSX: title + description + optional children slot |
| `SectionGrid` | `components/dashboard/section-grid.tsx` | Pure CSS grid wrapper |
| `StatusBadge` | `components/dashboard/status-badge.tsx` | Pure JSX with Tailwind classes, no interactivity |

### Issue 3: Components that could be Server Components with minor refactoring

| Component | File | What needs to change |
|---|---|---|
| `WidgetSkeleton` | `components/dashboard/widget-skeleton.tsx` | Uses `useMemo` only to compute `Math.max(0, lines - 2)` — trivially computed inline without a hook |
| `ChartPanel` | `components/dashboard/chart-panel.tsx` | No hooks, just conditional rendering. Only needs `'use client'` because it imports `WidgetSkeleton` which currently uses `useMemo` |
| `DataTable` | `components/dashboard/data-table.tsx` | Generic table renderer, no hooks. Receives `render` functions via props — these are callbacks, not hooks, so the component itself doesn't require client rendering. However, since the `render` callbacks come from Client Component parents, `DataTable` will be serialized as a Server Component and rendered on the server. The render callbacks are passed from client pages, so this works naturally. |

**Note on `DataTable`**: `DataTable` accepts `render` function props in its `Column<T>` interface. Functions cannot cross the server→client serialization boundary, but `DataTable` is always used *inside* Client Component pages that define these render functions. If `DataTable` becomes a Server Component, it can still be imported and used from Client Components — it will be treated as a client component in that context. However, since all its callers are client components anyway, converting it provides no bundle savings. **Leave it as-is.**

### Issue 4: `MetricCard` has unnecessary `'use client'` for its core functionality
- **File**: `components/dashboard/metric-card.tsx`
- Imports `TrendingUp`, `TrendingDown`, `Minus` from lucide-react and `Sparkline` (which uses Recharts).
- The sparkline and trend icons are optional props — the component works without them.
- However, the `Sparkline` import pulls Recharts into the module graph, which requires client rendering.
- **Verdict**: Keep as `'use client'` — it imports a charting component that needs the browser. Converting it would require splitting sparkline into a separate child, which adds complexity for marginal gain since `MetricCard` is always used inside client pages.

### Issue 5: No `server-only` guard on sensitive server modules
- **Files**: `lib/auth.ts`, `lib/db/queries.ts`, `lib/db/index.ts`, `lib/db/schema.ts`
- These files access `process.env` secrets (`ADMIN_SESSION_SECRET`, `ADMIN_PASSWORD_HASH`), database connections, and `next/headers`. If accidentally imported from a `'use client'` file, secrets could leak or builds would silently fail.
- **Best practice**: Add `import 'server-only'` at the top of these files for a hard build-time error if they're ever imported from client code.

### Issue 6: Pages fetch all data client-side via React Query — missed opportunity for server-side initial data
- All 6 dashboard pages are `'use client'` and fetch data exclusively via `useQuery` hooks (client-side fetch to `/api/metrics/*`).
- This means: page loads → empty shell renders → JS hydrates → client-side fetch fires → loading spinner → data renders. The user sees a skeleton for every page visit.
- **Best practice**: For read-heavy dashboards, fetch initial data server-side and pass it as `initialData` to React Query, or use the Suspense streaming pattern with server-side data fetching.
- **Trade-off**: This is the highest-impact change but also the most invasive. The current architecture works correctly — it's a performance optimization, not a correctness fix.

### Issue 7: No Server Actions for mutations
- Alert CRUD (create/update/delete) uses client-side `fetch` to API routes.
- Server Actions would provide: progressive enhancement (forms work without JS), automatic `revalidation`, type safety, and simpler code.
- **Trade-off**: Low priority. The current API route pattern works fine and is well-established in this codebase.

### Issue 8: Missing middleware for route protection
- `middleware.ts` was deleted (git status shows `D middleware.ts`), leaving dashboard routes unprotected server-side.
- This is a **security issue** separate from the Server Components audit, but worth flagging.

---

## Remediation Plan

### Step 1: Install `server-only` package and guard server modules
**Files to modify:**
- `package.json` — add `server-only` dependency
- `lib/auth.ts` — add `import 'server-only'` at top
- `lib/db/index.ts` — add `import 'server-only'` at top
- `lib/db/queries.ts` — add `import 'server-only'` at top
- `lib/db/schema.ts` — add `import 'server-only'` at top

### Step 2: Convert presentational components to Server Components
Remove `'use client'` from components that are pure render functions:

**File: `components/layout/page-header.tsx`**
- Remove `'use client'` directive. No other changes needed.

**File: `components/dashboard/section-grid.tsx`**
- Remove `'use client'` directive. No other changes needed.

**File: `components/dashboard/status-badge.tsx`**
- Remove `'use client'` directive. No other changes needed.

### Step 3: Convert `WidgetSkeleton` to Server Component
**File: `components/dashboard/widget-skeleton.tsx`**
- Remove `'use client'` directive
- Remove `useMemo` import — replace with inline `Math.max(0, lines - 2)`

### Step 4: Convert `ChartPanel` to Server Component
**File: `components/dashboard/chart-panel.tsx`**
- Remove `'use client'` directive. It has no hooks, no state, no events.
- It imports `WidgetSkeleton` which will also be a Server Component after Step 3.

### Step 5: Convert dashboard layout to Server Component
**File: `app/(dashboard)/layout.tsx`**
- Remove `'use client'` directive
- The layout imports `QueryProvider`, `TimeRangeProvider` (Client Components), `Sidebar`, and `Header` (Client Components)
- All of these are already Client Components with their own `'use client'` directives
- The layout just composes them around `{children}` — this is the donut pattern and works perfectly as a Server Component
- Server Components **can** import and render Client Components — the directive in the child file is what matters

### Step 6: No changes to pages (with rationale)
The 6 dashboard pages (`page.tsx`, `performance/page.tsx`, `alerts/page.tsx`, `database/page.tsx`, `deployments/page.tsx`, `settings/page.tsx`) will remain as `'use client'` because they all use React Query hooks (`useQuery`, `useMutation`) and interactive state. This is correct — they genuinely need client rendering.

The `login/page.tsx` also correctly uses `'use client'` for form state and `useRouter`.

---

## Files Modified (Summary)

| File | Change |
|---|---|
| `package.json` | Add `server-only` dependency |
| `lib/auth.ts` | Add `import 'server-only'` |
| `lib/db/index.ts` | Add `import 'server-only'` |
| `lib/db/queries.ts` | Add `import 'server-only'` |
| `lib/db/schema.ts` | Add `import 'server-only'` |
| `components/layout/page-header.tsx` | Remove `'use client'` |
| `components/dashboard/section-grid.tsx` | Remove `'use client'` |
| `components/dashboard/status-badge.tsx` | Remove `'use client'` |
| `components/dashboard/widget-skeleton.tsx` | Remove `'use client'`, replace `useMemo` with inline computation |
| `components/dashboard/chart-panel.tsx` | Remove `'use client'` |
| `app/(dashboard)/layout.tsx` | Remove `'use client'` |

## Verification

1. Run `pnpm install` to install `server-only`
2. Run `pnpm build` (or `npm run build`) and confirm zero type errors / build errors
3. Run `pnpm dev` and verify:
   - All dashboard pages render correctly
   - Theme switching works
   - Data loads via React Query polling
   - Login page works
   - Navigation between pages works
4. Run existing tests: `pnpm test` (vitest)
