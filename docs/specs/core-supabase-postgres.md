---
id: 1
title: 'Supabase Postgres Connection'
status: done
feature: core
related-features: [habits, finance, notes]
created: 2026-07-04
updated: 2026-07-04
---

# Supabase Postgres Connection

## Problem Statement

Momentum currently has no backend connectivity of any kind — habits, finance, and notes are all pure client-side Zustand `persist` stores writing to `localStorage`. There is no environment configuration scheme, no database client, and no server-side code path (no `createServerFn` usage exists anywhere in `src/`). Before any real user account or server-backed feature (starting with the [Auth: Login & Logout](./core-auth-login-logout.md) spec) can exist, the app needs a validated environment config and a pair of Supabase client factories that isolate all direct SDK usage behind a small, well-defined boundary — so that swapping backends later touches as few files as possible.

## Goals

- Install `@supabase/supabase-js` and `@supabase/ssr` as the only new dependencies for this spec.
- Add a zod-validated env module that fails fast on missing/invalid config.
- Add `.env.example` documenting the required vars.
- Add a browser Supabase client factory (`src/libs/supabase/client.ts`).
- Add a server Supabase client factory (`src/libs/supabase/server.ts`) wired to TanStack Start's per-request cookie primitives.
- Document a clear portability strategy: easy exit (self-host Supabase) vs. hard exit (swap auth provider entirely).

## Non-Goals

- No ORM/data layer for app data — habits, finance, notes remain pure Zustand `persist` stores; this spec is Auth/session infrastructure only.
- No custom `profiles` table or any app-defined Postgres schema — not needed for login/logout, which relies entirely on Supabase's built-in `auth.users`.
- No sign-up flow, no RLS policy authoring.
- No Supabase Realtime, Storage, or Edge Functions.
- No login/logout UI or router-guarding logic — that is entirely the [Auth: Login & Logout](./core-auth-login-logout.md) spec's scope; this spec only produces importable, testable client factories.

## Acceptance Criteria

- [ ] Given `VITE_SUPABASE_URL` or `VITE_SUPABASE_PUBLISHABLE_KEY` is missing or malformed, when the app boots (`bun --bun run dev` or `bun --bun run build`), then it throws a clear, human-readable error listing exactly which var(s) are invalid, before any Supabase call is attempted.
- [ ] Given valid env vars, when `getSupabaseBrowserClient()` is called from client code, then it returns a memoized `SupabaseClient` (one instance per browser tab) configured with the publishable key.
- [ ] Given an incoming server request, when `getSupabaseServerClient()` is called during that request's `beforeLoad`/`loader`/`createServerFn` execution, then it returns a fresh `SupabaseClient` (never reused across requests) that reads auth cookies from that request and writes any refreshed cookies back via `setCookie`.
- [ ] Given a fresh clone of the repo with no `.env`, when a contributor opens `.env.example`, then it lists both required vars with a comment explaining where to find them in the Supabase dashboard.
- [ ] Given the Portability section of this spec, when an engineer wants to self-host Supabase later, then the doc states plainly that swapping `VITE_SUPABASE_URL`/`VITE_SUPABASE_PUBLISHABLE_KEY` is the only required change, with zero code edits.

## Data Model Changes

None. No Zustand store changes. New non-store modules: `src/libs/env.ts`, `src/libs/supabase/client.ts`, `src/libs/supabase/server.ts`.

## UI / UX Notes

N/A — this spec has no UI surface.

## Edge Cases

- **Vite env prefix nuance:** Vite only inlines `VITE_`-prefixed vars into the _client_ bundle to prevent leaking server secrets to the browser. Server-side code (loaders, `createServerFn`) can read `import.meta.env.VITE_*` too — it's just also-available there, not excluded. Since the Supabase publishable key is designed to be public (protected by RLS, not a secret), using the **same** `VITE_`-prefixed pair for both browser and server clients is correct and avoids two vars that must always be kept in sync.
- **Key naming (publishable vs. legacy anon):** Supabase's current dashboard/docs issue a `sb_publishable_...` **publishable key**, the successor to the legacy `anon` key (same public/RLS-protected trust model, new revocable format). Use `VITE_SUPABASE_PUBLISHABLE_KEY` as the var name to match what the Supabase dashboard's "Connect" instructions actually hand out today — don't call it `ANON_KEY` even though the concept is the same, to avoid confusing future contributors copying fresh values from the dashboard.
- **Fail fast, not fail late:** validation happens at module-evaluation time of `src/libs/env.ts` (import-time), not lazily inside the first Supabase call, so a misconfigured deploy fails the build/boot loudly rather than surfacing as a cryptic `TypeError` deep in a login attempt.
- **URL validation strictness:** validate `VITE_SUPABASE_URL` as a generic `z.string().url()`, deliberately **not** pattern-matched against `*.supabase.co` — a self-hosted Supabase URL must pass validation unchanged. This is a direct, deliberate portability decision.
- **Accidental cross-bundle import:** `src/libs/supabase/server.ts` imports `@tanstack/react-start/server`, which pulls in server-only internals. Wrap its exported factory in `createServerOnlyFn()` so that an accidental import from a client component fails loudly/predictably rather than silently breaking the browser bundle.

## Implementation Notes

1. `package.json` — add `@supabase/supabase-js` (`^2.110.0`), `@supabase/ssr` (`^0.12.0`); run `bun install`.
2. `.env.example` (repo root — `.gitignore` already excludes `.env`):
   ```
   # Supabase project URL and publishable key (Project Settings → API in the Supabase dashboard)
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
   ```
3. `src/libs/env.ts` — new file:

   ```ts
   import { z } from 'zod'

   const envSchema = z.object({
     VITE_SUPABASE_URL: z.string().url(),
     VITE_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
   })

   export function parseEnv(source: Record<string, unknown>) {
     const result = envSchema.safeParse(source)
     if (!result.success) {
       const issues = result.error.issues
         .map((issue) => `- ${issue.path.join('.')}: ${issue.message}`)
         .join('\n')
       throw new Error(`Invalid environment configuration:\n${issues}`)
     }
     return result.data
   }

   export const env = parseEnv(import.meta.env)
   ```

   Exporting `parseEnv` as a pure function (separate from the eagerly-evaluated `env` singleton) is what makes this unit-testable without needing to stub `import.meta.env`.

4. `src/libs/supabase/client.ts` — new file, browser factory (memoized per tab):

   ```ts
   import { createBrowserClient } from '@supabase/ssr'
   import { env } from '#/libs/env'

   import type { SupabaseClient } from '@supabase/supabase-js'

   let browserClient: SupabaseClient | undefined

   export function getSupabaseBrowserClient(): SupabaseClient {
     browserClient ??= createBrowserClient(
       env.VITE_SUPABASE_URL,
       env.VITE_SUPABASE_PUBLISHABLE_KEY,
     )
     return browserClient
   }
   ```

5. `src/libs/supabase/server.ts` — new file, server factory (one instance **per request**, never memoized across requests, since it carries request-scoped cookies):

   ```ts
   import { createServerClient } from '@supabase/ssr'
   import { createServerOnlyFn } from '@tanstack/react-start'
   import { getCookies, setCookie } from '@tanstack/react-start/server'
   import { env } from '#/libs/env'

   import type { SupabaseClient } from '@supabase/supabase-js'

   export const getSupabaseServerClient = createServerOnlyFn(
     (): SupabaseClient =>
       createServerClient(
         env.VITE_SUPABASE_URL,
         env.VITE_SUPABASE_PUBLISHABLE_KEY,
         {
           cookies: {
             getAll() {
               return Object.entries(getCookies()).map(([name, value]) => ({
                 name,
                 value,
               }))
             },
             setAll(cookiesToSet) {
               cookiesToSet.forEach(({ name, value, options }) => {
                 setCookie(name, value, options)
               })
             },
           },
         },
       ),
   )
   ```

   Callers must only invoke this from within a server request lifecycle (root `beforeLoad`, a loader, or a `createServerFn` handler) — never at module scope, never from client code.

6. `CLAUDE.md` — add a short "Backend / Supabase" subsection to the Architecture section referencing `src/libs/env.ts` and `src/libs/supabase/*` once this spec ships.

**Portability strategy:**

> **Easy exit — self-hosting Supabase:** The underlying data store is vanilla Postgres, and the client libraries (`@supabase/supabase-js`, `@supabase/ssr`) talk to any Supabase instance (hosted or self-managed) via the same REST/Auth API surface. Migrating to a self-hosted Supabase deployment requires changing only `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` — zero code changes, because all SDK usage is isolated behind `src/libs/supabase/client.ts` and `src/libs/supabase/server.ts`.
>
> **Hard exit — leaving Supabase Auth entirely:** What's genuinely hard to migrate is Supabase Auth (GoTrue)'s user model, its JWT format/claims, and any future RLS policies written against `auth.uid()`. If a future migration to a different auth provider (or a hand-rolled auth server) is ever needed, the blast radius is intentionally limited to `src/libs/supabase/*` and `src/libs/auth/*` (see the [Auth: Login & Logout](./core-auth-login-logout.md) spec) — route/component code never imports `@supabase/supabase-js` or `@supabase/ssr` directly, only the auth adapter functions. A vanilla-Postgres connection string (for app data, if/when a data layer is added later) would remain portable regardless — an ORM like Drizzle or Prisma could sit on top of it without touching auth at all; not needed for this scope, mentioned only for future context.

## Test Plan

**Unit tests** (`src/libs/__test__/env.test.ts`):

- [ ] `parseEnv` returns parsed data for valid input.
- [ ] `parseEnv` throws with a message naming the missing/invalid key(s).

**Unit tests** (`src/libs/supabase/__test__/client.test.ts`, `src/libs/supabase/__test__/server.test.ts`):

- [ ] `getSupabaseBrowserClient()` calls `createBrowserClient` (mocked via `vi.mock('@supabase/ssr')`) with the env URL/key and returns the same instance on repeat calls.
- [ ] `getSupabaseServerClient()`'s cookie adapter: mock `getCookies` to return `{ foo: 'bar' }`, assert `cookies.getAll()` returns `[{ name: 'foo', value: 'bar' }]`; call `cookies.setAll([{ name: 'a', value: '1', options: {...} }])` and assert the mocked `setCookie` was called with matching args.

**Manual verification:**

- [ ] Boot with valid `.env` → app starts without throwing.
- [ ] Boot with a missing var → terminal/error overlay shows the zod validation message clearly.

## Open Questions

- [ ] **Spike before implementing the Auth spec:** Does a `Set-Cookie` written via `setCookie()` from inside a root-route `beforeLoad` (as opposed to a `createServerFn`) actually land on the outgoing SSR response before headers are sent? The underlying APIs (`getRequest`, `getCookies`, `setCookie`) are confirmed to exist in `@tanstack/react-start/server` and are documented as general request-lifecycle utilities, not server-function-only, but this hasn't been exercised end-to-end in this codebase. Recommend a short spike: add a throwaway `beforeLoad` in `__root.tsx` calling `setCookie('spike-test', '1')` and confirm via browser devtools that the cookie is actually set on first (SSR) page load.
- [ ] Minor type-shape risk: `@supabase/ssr`'s cookie options type and TanStack Start's cookie-options type may not align field-for-field (e.g. `sameSite` casing, `priority`, `partitioned`). Expect at most a small type assertion at the `setAll` boundary — not expected to block functionality.
- [ ] Should `getSupabaseServerClient()`'s `createServerOnlyFn` wrapper's runtime behavior (throw vs. dead-code-eliminated on misuse) be verified explicitly, or is it sufficient as defense-in-depth alongside code review discipline?
