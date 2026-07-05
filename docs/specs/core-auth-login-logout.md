---
id: 2
title: 'Auth: Login & Logout'
status: done
feature: core
related-features: [habits, finance, notes]
created: 2026-07-04
updated: 2026-07-04
---

# Auth: Login & Logout

## Problem Statement

There is no authentication anywhere in Momentum today. Every route — including `/habits`, `/finance`, and `/notes`, all of which hold personal data — is publicly reachable by anyone with the URL, and there is no concept of a logged-in user or session. The app needs an email/password login flow, a session that's known server-side before the first byte is rendered (no auth flash), and every existing route gated behind it.

This spec depends on the [Supabase Postgres Connection](./core-supabase-postgres.md) spec, which provides `src/libs/env.ts`, `src/libs/supabase/client.ts`, and `src/libs/supabase/server.ts`.

## Goals

- `src/libs/auth/auth-adapter.ts` exposing `signInWithPassword`, `signOut`, `getSession`, `getUser` — the only file (besides the client factories from the connection spec) that touches `@supabase/supabase-js`/`@supabase/ssr` auth APIs directly.
- Root route (`src/routes/__root.tsx`) `beforeLoad` resolves the current user server-side per request and makes it available to all descendant routes via TanStack Router's context-merging.
- `src/routes/_authenticated.tsx` pathless layout with a `beforeLoad` guard redirecting unauthenticated visitors to `/login`; `habits/`, `finance/`, `notes/` move under it.
- `src/routes/login/index.tsx` — public email/password login route.
- A logout action wired into `src/components/TopBar.tsx`'s existing profile dropdown.
- Query cache is cleared on logout.
- `src/components/TopBar.tsx`'s profile avatar (currently hardcoded `"NS"`) displays initials derived from the real logged-in user's email.
- `AppShell` (sidebar + `TopBar` chrome) is scoped to authenticated routes only — moved from `__root.tsx`'s `RootDocument` into `_authenticated.tsx`'s route component — so `/login` and the public `(marketing)/about` route render without it.

## Non-Goals

- Sign-up, password reset/forgot-password, magic link, OAuth — out of scope (users provisioned manually via the Supabase dashboard).
- Role-based access control — a single implicit "authenticated" role.
- App-level login rate-limiting/lockout — Supabase Auth (GoTrue) already rate-limits sign-in attempts server-side; no app-level equivalent needed for v1.
- RLS policy authoring for app data — no app data tables exist yet.

## Acceptance Criteria

- [ ] Given an unauthenticated visitor, when they navigate to `/habits`, `/finance`, or `/notes`, then they are redirected to `/login?redirect=<original-path>` before any protected content renders (server-side, no flash).
- [ ] Given a visitor lands on `/login` with valid credentials, when they submit the form, then they are redirected to the `redirect` search param's path if present, otherwise to `/habits`.
- [ ] Given a visitor submits invalid credentials, when the form is submitted, then an inline error message appears and the user stays on `/login`.
- [ ] Given an already-authenticated user, when they navigate directly to `/login`, then they are immediately redirected away (to `/habits` or their intended destination) rather than seeing the login form.
- [ ] Given a logged-in user, when they click "Log out" in the `TopBar` profile menu, then their session is cleared, the TanStack Query cache is cleared, and they land on `/login`.
- [ ] Given a user with an expired or invalid session cookie, when they load any protected route via a fresh SSR request, then it is treated as unauthenticated (redirect to `/login`), not as a crash.
- [ ] Given the root route's `beforeLoad`, when any route (protected or not) is visited, then the current user is resolved exactly once per request and shared via context — no duplicate Supabase calls per route segment.
- [ ] Given the `/` route, when an unauthenticated visitor hits it, then they end up at `/login` (via `/` → `/habits` → `_authenticated` guard's redirect), without `/`'s own `beforeLoad` needing to know about auth.
- [ ] Given a logged-in user, when they open the `TopBar` profile menu, then the avatar shows initials derived from their real email address instead of the hardcoded `"NS"` placeholder.
- [ ] Given an unauthenticated visitor, when they land on `/login`, then no sidebar or `TopBar` chrome is rendered — just the centered login card.

## Data Model Changes

No Zustand store changes. This spec changes **router context** (a TypeScript-level, not Zustand-level, change):

**Router context:** the root `beforeLoad` returns `{ user: AppUser | null }`, which TanStack Router's typegen automatically merges into the inferred `context` type for every descendant route (`_authenticated.tsx`, `login/index.tsx`, etc.) — no manual edit to the `MyRouterContext` interface itself is needed, since that interface represents only the router-creation-time context (`queryClient`), not per-request `beforeLoad`-derived context.

```ts
// src/libs/auth/auth-adapter.ts
export type AppUser = import('@supabase/supabase-js').User
```

Re-exporting `AppUser` from the adapter (rather than importing `User` from `@supabase/supabase-js` in route files directly) keeps the Supabase type dependency confined to one file, matching the portability goal from the connection spec.

## UI / UX Notes

- `src/routes/login/index.tsx` — centered card layout, reusing existing `Input`/`Label`/`Button` primitives. No shadcn `Form` wrapper — none exists in this codebase; match `new-habit-modal.tsx`'s raw `react-hook-form` + `Label`/`Input` pattern exactly. Fields: email, password. Submit button shows a loading/disabled state while the request is in flight. An error banner appears on failed sign-in (e.g. `<p className="text-sm text-destructive">`).
- `src/components/TopBar.tsx` — replace the currently-disabled `DropdownMenuItem` containing the `User` icon and "Profile" label with a "Log out" item, reusing the existing `DropdownMenuItem`/`DropdownMenuSeparator` structure already in that file.
- No loading spinner needed for the "am I logged in" check on the client — resolution happens server-side pre-render, so there is no client-visible loading state for the initial auth gate.

## Edge Cases

- **`getUser()` vs `getSession()`:** Supabase's guidance is that `getSession()` only reads the (possibly stale, unverified) JWT from the cookie without contacting the Auth server, while `getUser()` revalidates against Supabase Auth. The root `beforeLoad`'s **server branch** (SSR / full page loads — the actual security boundary, since this is where protected content is first rendered) **must use `getUser()`**. The **client branch** (re-run on every SPA navigation per the edge case below) uses the cheaper `getSession()` instead, trading network-verified freshness for UX — see Open Questions for the resolved decision.
- **Open-redirect protection:** the `redirect` search param on `/login` must be validated as a same-origin relative path (must start with a single `/`, reject `//`-prefixed or absolute URLs) before being used as a navigation target, to prevent a crafted `redirect=https://evil.com` link from being honored.
- **Already-authenticated visit to `/login`:** handled by `login/index.tsx`'s own `beforeLoad` redirecting away when `context.user` is present — reuses the same root-populated context, no duplicate Supabase call.
- **Logout while offline (PWA context):** `signOut()` will fail its network call to GoTrue while offline. For v1: attempt the network sign-out, but regardless of its outcome, clear the local Supabase client state and TanStack Query cache and navigate to `/login` — worst case, a stale refresh-token cookie remains valid server-side until natural expiry. Acceptable given this is a personal/small-user-count app.
- **In-flight TanStack Query cache on logout:** call `queryClient.clear()` (via `useQueryClient()`, already globally available through the existing `setupRouterSsrQueryIntegration` `Wrap` injection in `src/router.tsx`) alongside the logout redirect, to prevent any cached data from a previous session leaking into a subsequent one.
- **Root `beforeLoad` re-running on every client-side navigation:** since root matches every route, a network-verified check on every SPA navigation would add a round-trip per click. Resolved (see Open Questions): the client branch of `getUser()` reads the local session cookie via `getSession()` instead — no network call — while the server branch (SSR boundary) still revalidates with a real `getUser()` call. This means a client-side session that's been revoked server-side (e.g. remotely signed out) won't be caught until the next full page load/SSR request, which is an accepted v1 tradeoff.
- **`AppShell` currently wraps every route:** `__root.tsx`'s `RootDocument` unconditionally renders `<AppShell>{children}</AppShell>`, which includes `TopBar` (with the new avatar) and `AppSidebar`. Since `/login` is a public, unauthenticated route with its own centered-card layout, it must not render inside that chrome. Fix: move `<AppShell>` out of `RootDocument` (which now renders `{children}` directly) and into `_authenticated.tsx`'s route component, wrapping `<Outlet />`. This also means the pre-existing (currently unimplemented) `(marketing)/about` route will render without sidebar/TopBar chrome, which is correct for a public marketing page.
- **Empty state / persistence boundary:** N/A for this feature — there is no local data to display empty states for; the "persistence boundary" is the session cookie itself, which survives a page reload by design (that's the point of SSR-side session resolution).

## Implementation Notes

1. `src/libs/auth/auth-adapter.ts` — new file:

   ```ts
   import { createIsomorphicFn } from '@tanstack/react-start'
   import { getSupabaseBrowserClient } from '#/libs/supabase/client'
   import { getSupabaseServerClient } from '#/libs/supabase/server'

   import type { User } from '@supabase/supabase-js'

   export type AppUser = User

   export async function signInWithPassword(email: string, password: string) {
     const supabase = getSupabaseBrowserClient()
     return supabase.auth.signInWithPassword({ email, password })
   }

   export async function signOut() {
     const supabase = getSupabaseBrowserClient()
     return supabase.auth.signOut()
   }

   // Server branch: revalidates against Supabase Auth. This is the real security
   // boundary (SSR / full page loads render protected content based on this).
   // Client branch: reads the local session cookie only, no network round-trip.
   // Root beforeLoad re-runs this on every SPA navigation, so the client branch
   // intentionally trades network-verified freshness for UX — a revoked session
   // won't be caught client-side until the next full page load.
   export const getUser = createIsomorphicFn()
     .server(async (): Promise<AppUser | null> => {
       const supabase = getSupabaseServerClient()
       const { data, error } = await supabase.auth.getUser()
       return error ? null : data.user
     })
     .client(async (): Promise<AppUser | null> => {
       const supabase = getSupabaseBrowserClient()
       const { data } = await supabase.auth.getSession()
       return data.session?.user ?? null
     })

   // Cheap, local, unverified — exposed directly for any future non-security-critical reads.
   export const getSession = createIsomorphicFn()
     .server(async () => {
       const supabase = getSupabaseServerClient()
       const { data } = await supabase.auth.getSession()
       return data.session
     })
     .client(async () => {
       const supabase = getSupabaseBrowserClient()
       const { data } = await supabase.auth.getSession()
       return data.session
     })
   ```

2. `src/routes/__root.tsx` — add `beforeLoad`, and remove `AppShell` from `RootDocument` (moved to `_authenticated.tsx` in step 4):

   ```ts
   import { getUser } from '#/libs/auth/auth-adapter'
   // ...
   export const Route = createRootRouteWithContext<MyRouterContext>()({
     beforeLoad: async () => ({ user: await getUser() }),
     // existing head/notFoundComponent unchanged
   })

   function RootDocument({ children }: { children: React.ReactNode }) {
     return (
       <html lang="en" suppressHydrationWarning>
         <head>{/* unchanged */}</head>
         <body className="font-sans antialiased selection:bg-primary/30">
           {children}
           {/* AppShell removed from here — devtools/Toaster/Scripts unchanged */}
         </body>
       </html>
     )
   }
   ```

3. **Route reorganization** (file moves, not just new files):
   - Move `src/routes/habits/{index.tsx,-components/,-utils/}` → `src/routes/_authenticated/habits/{...}` (content unchanged).
   - Move `src/routes/finance/{index.tsx,-components/,-utils/}` → `src/routes/_authenticated/finance/{...}`.
   - Move `src/routes/notes/{index.tsx,-components/,-utils/}` → `src/routes/_authenticated/notes/{...}`.
   - `src/routes/index.tsx` stays at top level, unchanged (`/` → redirect to `/habits`; auth enforcement happens once the redirect lands on `/habits`, which is now under `_authenticated`).
   - `src/routes/(marketing)/about/` stays as-is, outside `_authenticated` (public).

4. `src/routes/_authenticated.tsx` — new pathless layout route; also now owns rendering `AppShell` (moved from `__root.tsx` in step 2), so sidebar/`TopBar` chrome only appears for authenticated routes:

   ```tsx
   import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'
   import { AppShell } from '#/components/AppShell'

   export const Route = createFileRoute('/_authenticated')({
     beforeLoad: ({ context, location }) => {
       if (!context.user) {
         throw redirect({
           to: '/login',
           search: { redirect: location.href },
         })
       }
     },
     component: () => (
       <AppShell>
         <Outlet />
       </AppShell>
     ),
   })
   ```

5. `src/routes/login/index.tsx` — new public route:

   ```tsx
   import { createFileRoute, redirect } from '@tanstack/react-router'
   import { z } from 'zod'
   import { LoginForm } from './-components/login-form'

   const loginSearchSchema = z.object({
     redirect: z
       .string()
       .regex(/^\/(?!\/)/, 'Must be a relative path')
       .optional(),
   })

   export const Route = createFileRoute('/login')({
     validateSearch: loginSearchSchema,
     beforeLoad: ({ context, search }) => {
       if (context.user) {
         throw redirect({ to: search.redirect ?? '/habits' })
       }
     },
     component: LoginPage,
   })

   function LoginPage() {
     return (
       <main className="flex min-h-screen items-center justify-center px-4">
         <LoginForm />
       </main>
     )
   }
   ```

6. `src/routes/login/-components/login-form.tsx` — new file, `react-hook-form` + `zodResolver` + inline zod schema (matching `new-habit-modal.tsx` conventions):

   ```ts
   const loginFormSchema = z.object({
     email: z.string().email('Enter a valid email'),
     password: z.string().min(1, 'Password is required'),
   })
   type LoginFormValues = z.infer<typeof loginFormSchema>
   ```

   On submit: call `signInWithPassword`, on error set a local `formError` state and re-enable the form; on success call `navigate({ to: Route.useSearch().redirect ?? '/habits' })`.

7. `src/components/TopBar.tsx` — import `signOut` from `#/libs/auth/auth-adapter`, `useQueryClient` from `@tanstack/react-query`, `useNavigate` and `useRouteContext` from `@tanstack/react-router`; replace the disabled "Profile" `DropdownMenuItem` with a "Log out" item calling:

   ```ts
   async function handleLogout() {
     await signOut()
     queryClient.clear()
     await navigate({ to: '/login' })
   }
   ```

   Also replace the hardcoded `"NS"` avatar span with initials derived from the real user, read via `useRouteContext({ from: '__root__' })` (populated by the root `beforeLoad` from step 2):

   ```ts
   const user = useRouteContext({ from: '__root__', select: (c) => c.user })
   const initials = user?.email?.slice(0, 2).toUpperCase() ?? '?'
   ```

   `TopBar` is always rendered inside `_authenticated` in practice (it's part of `AppShell`, which only wraps authenticated routes), so `user` is expected to be non-null here; the `?? '?'` fallback is defensive only.

8. Regenerate `routeTree.gen.ts` by running `bun --bun run dev` once (never hand-edit — the router plugin picks up the moved/added route files automatically and nests `Finance`/`Habits`/`Notes` routes under the new `_authenticated` layout route id).
9. `CLAUDE.md` — after this spec ships, add a one-line note to the Routing subsection: "`/habits`, `/finance`, `/notes` are nested under the `_authenticated` pathless layout (`src/routes/_authenticated.tsx`), which redirects unauthenticated visitors to `/login` and renders `AppShell` (sidebar/`TopBar` chrome) — `__root.tsx` no longer renders it directly, so public routes like `/login` and `/(marketing)/about` are chrome-free."

## Test Plan

**Unit tests** (`src/libs/auth/__tests__/auth-adapter.test.ts`):

- [ ] `signInWithPassword` calls `supabase.auth.signInWithPassword` with `{ email, password }` and returns its result (mock `#/libs/supabase/client`).
- [ ] `signOut` calls `supabase.auth.signOut`.
- [ ] `getUser` (server branch, mocked) calls `supabase.auth.getUser()` and returns `null` when Supabase returns an error, the user object otherwise.
- [ ] `getUser` (client branch, mocked) calls `supabase.auth.getSession()` (not `.getUser()`) and returns `data.session?.user ?? null`.

**Component tests** (`src/routes/login/-components/__test__/login-form.test.tsx`):

- [ ] Renders email/password fields and a submit button.
- [ ] Shows a validation error when submitting an empty/invalid email.
- [ ] Shows an inline error message when `signInWithPassword` (mocked) resolves with an error, and does not navigate.
- [ ] Calls navigation to the expected destination when `signInWithPassword` (mocked) resolves successfully.

**Component tests** (`src/components/__test__/TopBar.test.tsx` or existing test file if present):

- [ ] Renders avatar initials derived from `context.user.email` (mocked router context) instead of `"NS"`.

**Manual verification:**

- [x] Visit `/habits` while logged out → redirected to `/login?redirect=/habits`.
- [x] `/login` renders as a standalone centered card, with no sidebar or `TopBar` visible.
- [x] Log in with valid credentials → redirected back to `/habits`.
- [x] Log in with invalid credentials → inline error shown, stays on `/login`.
- [x] While logged in, visit `/login` directly → redirected away immediately.
- [x] `TopBar` avatar shows initials from the logged-in user's email, not `"NS"`.
- [x] Click "Log out" in `TopBar` → redirected to `/login`; visiting `/habits` again requires re-login.
- [x] Reload a protected route mid-session → still authenticated (no flash of login page, no flash of protected content before redirect when logged out).

## Open Questions

- [x] Should the client-side branch of `getUser()` (used on every SPA navigation, since root `beforeLoad` re-runs per navigation) actually call `getUser()` (network round-trip on every click) or the cheaper local `getSession()` for UX-only purposes, deferring true enforcement to the server-side branch (which is the actual security boundary for SSR page delivery)? **Decided:** client branch uses `getSession()` (no network call); server branch keeps `getUser()` as the real security boundary. See Implementation Notes step 1 and the updated Edge Cases entry.
- [x] Should logout still redirect to `/login` even if `signOut()`'s network call fails while offline, given the PWA/offline context? **Decided: yes** — always clear local state and redirect regardless of network outcome, as originally recommended.
- [ ] After successful login, is a client-side `navigate({ to })` sufficient to pick up the freshly-set session cookie for the subsequent `_authenticated` `beforeLoad` check, or is a full `window.location.assign()` needed for reliability? Still open — no answer yet; verify manually during implementation and fall back to a full navigation if the client-side context re-evaluation doesn't reliably reflect the new cookie.
- [x] Should `TopBar`'s profile avatar (currently hardcoded "NS" initials) be wired to the real logged-in user's email once auth exists? **Decided: yes, in scope for this spec** — added to Goals, Acceptance Criteria, and Implementation Notes step 7.
