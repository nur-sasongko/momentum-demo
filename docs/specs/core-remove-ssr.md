---
title: 'Remove SSR'
status: in-progress
feature: core
created: 2026-07-04
updated: 2026-07-04
---

# Remove SSR

## Problem Statement

Momentum is built on `@tanstack/react-start`, a full SSR framework, but nothing in the app actually needs server rendering: there are zero route `loader`s, zero `createServerFn` calls, and the only server-only code path (`getSupabaseServerClient` in `src/libs/supabase/server.ts`, used by `auth-adapter.ts`'s server branch) exists solely to satisfy SSR's "resolve auth before first byte" pattern. All real feature data (habits, finance, notes) lives in Zustand `persist` stores in `localStorage` — there are no Postgres tables and no RLS-protected remote reads, confirmed via a repo-wide search (zero `.from()` calls, no migrations folder). Supabase is used _only_ for auth.

Today's production build is a stateful Bun server: `vite.config.ts` wires `tanstackStart()` + `nitro()` (nitro auto-detected the `bun` preset, producing `server/index.mjs`, per `.output/nitro.json`). There is no existing static-hosting config (no `vercel.json`/`netlify.toml`/`wrangler.toml`) — this app has never actually been deployed to a static target. SSR imposes real costs (a server process to run and deploy, a split `dist/client`/`dist/server` build that complicates the PWA service-worker pipeline, extra dependency surface) with no corresponding benefit for this app.

## Goals

- Replace `@tanstack/react-start`'s document-shell/SSR machinery with plain `@tanstack/react-router` client-only rendering, producing a flat static `dist/` from `vite build`.
- Preserve existing route structure, file-based routing, auth gating (`_authenticated.tsx`), and all feature UI unchanged.
- Preserve PWA installability (manifest + service worker) against the new flat `dist/` output.
- Reduce the dependency surface: drop `nitro`, `@tanstack/react-start`, `@tanstack/react-router-ssr-query`, `@supabase/ssr`.
- Keep auth working end-to-end (login, logout, protected-route redirect) using a client-only Supabase session check.

## Non-Goals

- Not changing the auth _security model_ beyond what's already been decided (client-only `getSession()`, no server-side `getUser()` revalidation) — accepted because there is no RLS-protected remote data at stake; worst case is UI-level access, not data exposure.
- Not adding a new hosting/deploy config (`vercel.json`, `netlify.toml`, `wrangler.toml`) — out of scope. A static host will need SPA-fallback rewrites (all paths → `/index.html`); that's a deployment prerequisite for a future spec, not this one.
- Not changing any feature behavior in habits/finance/notes — pure infra migration.
- Not adding SSR back in any form (e.g. prerendering) — deliberately fully client-rendered.

## Acceptance Criteria

- [x] Given a fresh `bun --bun run build`, when the build completes, then `dist/` is a flat directory containing `index.html`, hashed JS/CSS assets, `manifest.webmanifest`, and `sw.js` — no `dist/client`/`dist/server` split.
- [x] Given `bun --bun run preview` serves the built `dist/`, when a user opens `/`, then the app boots, renders, and routes client-side with no console errors referencing missing server assets.
- [ ] Given an unauthenticated visitor opens `/habits` directly, when the initial `getSession()` check resolves, then they are redirected to `/login?redirect=/habits`. (not manually verified in-browser — logic unchanged from prior `_authenticated.tsx` guard)
- [ ] Given a logged-in user, when they reload any protected route, then a brief pending state (not a flash of protected content, not a flash of the login page) is shown until the session check resolves, then the correct route renders. (not manually verified in-browser)
- [ ] Given a user logs in via `/login`, when submission succeeds, then they land on the `redirect` target or `/habits`, matching current behavior. (not manually verified in-browser)
- [ ] Given a user clicks "Log out", when the action completes, then the Supabase client session and TanStack Query cache are cleared and they land on `/login`. (not manually verified in-browser)
- [ ] Given the PWA install flow, when a user installs the app from the built `dist/`, then the manifest and service worker are both valid and installable (verified via DevTools Application tab). (not manually verified in-browser; `dist/manifest.webmanifest` and `dist/sw.js` are confirmed present and generated)
- [x] Given `package.json`, when dependencies are audited, then `nitro`, `@tanstack/react-start`, `@tanstack/react-router-ssr-query`, and `@supabase/ssr` are absent, and no source file imports them.
- [x] Given the test suite, when `bun run test` runs, then it passes with no references to `createServerOnlyFn`, `createIsomorphicFn`, or `getSupabaseServerClient` remaining anywhere in `src/` (pre-existing unrelated `env.test.ts` failure aside — fails identically on `master`).

## Data Model Changes

None. No Zustand store changes. Router context shape (`{ user: AppUser | null }` from root `beforeLoad`) is unchanged in shape, only in how it's computed (client-only instead of isomorphic).

## UI / UX Notes

- New: a lightweight pending/loading UI shown while the root/`_authenticated` `beforeLoad`'s session check resolves on first page load (previously invisible because SSR resolved this before any HTML was sent). Implemented via TanStack Router's `pendingComponent` on `_authenticated.tsx` plus `defaultPendingMs`/`pendingMinMs` tuning to avoid a flash on fast local-session reads.
- No other visual changes — `AppShell`, `TopBar`, sidebar, login card layout are untouched.
- Per-route dynamic `<title>` (e.g. `login/index.tsx`'s "Log in — Momentum") is dropped for v1 — a known, accepted regression, since document-head merging requires `@tanstack/react-start`.

## Edge Cases

- **Loss of "no auth flash" guarantee:** Previously the SSR server branch of `getUser()` rendered protected content only after real server-side revalidation, so a full page load of `/habits` never flashed protected UI before redirecting. In the SPA world, the first render must wait for `getSession()` (async, reads `localStorage` via the Supabase client) before deciding to render `<Outlet />` or redirect. Handled via `pendingComponent` on `_authenticated.tsx` — the router shows a pending state until `beforeLoad` resolves, so protected content still never flashes; only a brief pending state is visible.
- **Stale/revoked session:** Accepted tradeoff per the client-only `getSession()` design (no network call, reads local JWT only) — this already existed for subsequent navigations under SSR; this spec extends it to the initial load too, since there is no more server branch to fall back on.
- **SPA fallback routing:** static hosts must be configured to rewrite all non-asset paths to `/index.html`. `bun run preview` (Vite's own preview server) already does this automatically, which could mask the requirement until real deployment — flagged as a deployment prerequisite, out of scope here.
- **Document head / theme-init script:** `__root.tsx`'s `head()` + `<HeadContent />` mechanism and the inline `THEME_INIT_SCRIPT` (dark-mode flash prevention) move into a new static `index.html` as plain `<head>` tags, since there's no more per-route `head()` merging into a server-rendered document.
- **Implicit `QueryClientProvider`:** `setupRouterSsrQueryIntegration` is currently the _only_ source of `QueryClientProvider` in the app (it monkey-patches `router.options.Wrap`). Removing it without adding an explicit provider would break `useQueryClient()` in `TopBar.tsx` and any future `useQuery`/`useMutation` calls — must be replaced with an explicit `QueryClientProvider` wrap.

## Implementation Notes

1. **`src/libs/supabase/client.ts`** — replace `createBrowserClient` (`@supabase/ssr`) with `createClient` (`@supabase/supabase-js`), same memoized-singleton pattern.
2. **Delete `src/libs/supabase/server.ts`** entirely.
3. **`src/libs/auth/auth-adapter.ts`** — drop `createIsomorphicFn().server(...).client(...)`; collapse `getUser()`/`getSession()` to plain async functions using only `getSupabaseBrowserClient()` + `getSession()`. Update the doc comment describing the old isomorphic split to note this is now client-only/unverified.
4. **`src/router.tsx`** — remove `setupRouterSsrQueryIntegration` call/import; replace with an explicit `router.options.Wrap` (or a wrapper in the new client entry) rendering `<QueryClientProvider client={context.queryClient}>{children}</QueryClientProvider>`.
5. **New `src/entry-client.tsx`** — client bootstrap: `ReactDOM.createRoot(document.getElementById('root')!).render(<StrictMode><RouterProvider router={router} /></StrictMode>)`.
6. **New `index.html`** at project root — charset, viewport, title, theme-color meta, manifest link, apple-touch-icon, stylesheet link (`src/styles.css`), inline `THEME_INIT_SCRIPT` copied verbatim (comment cross-referencing `src/hooks/use-theme.ts` as source of truth). Body: `<div id="root"></div>` + `<script type="module" src="/src/entry-client.tsx">`.
7. **`src/routes/__root.tsx`** — replace `shellComponent: RootDocument` + `<Scripts />` + `<HeadContent />` with a plain `component` rendering `<Outlet />` + `<TanStackDevtools>` + `<Toaster />`. Drop `head: () => ({...})` and the `appCss` import (moved to `index.html`). Keep `beforeLoad: async () => ({ user: await getUser() })`.
8. **`src/routes/login/index.tsx`** — drop its `head: () => ({...})`.
9. **`_authenticated.tsx`** — add `pendingComponent` + `defaultPendingMs`/`pendingMinMs`.
10. **`vite.config.ts`** — remove `tanstackStart()` import/plugin; add `tanstackRouter({ target: 'react', autoCodeSplitting: true })` from `@tanstack/router-plugin/vite` (order: before `viteReact()`). Already a direct dependency, no new install.
11. **`package.json`** — remove `nitro`, `@tanstack/react-start`, `@tanstack/react-router-ssr-query`, `@supabase/ssr`. Run `bun install` after and check lockfile diff.
12. **`scripts/generate-sw.ts`** — update `dist/client` path references to flat `dist` (rename variable, e.g. `distClient` → `distDir`).
13. **`docs/architecture/pwa.md`** — update "on top of TanStack Start SSR" framing, `dist/client/sw.js` → `dist/sw.js` path, and build/runtime flow description.
14. **`CLAUDE.md`** — update Backend/Supabase section (server client factory no longer exists) and any SSR mentions in Routing/Architecture sections.

## Test Plan

**Search-and-fix pass** (run before/after editing to confirm scope):

```
grep -rln "createServerOnlyFn\|createIsomorphicFn\|getSupabaseServerClient\|@tanstack/react-start\|@tanstack/react-router-ssr-query\|@supabase/ssr\|shellComponent\|<Scripts" src/ vite.config.ts package.json
```

**Unit tests:**

- No existing tests reference `createIsomorphicFn`/`getSupabaseServerClient`/`@supabase/ssr` (confirmed via the search-and-fix grep above, both before and after implementation) — no test updates were required. No `auth-adapter` test file exists in this codebase; adding one is out of scope for this spec.

**Manual verification:**

- [x] `bun --bun run build` completes; `dist/` is flat, contains `index.html`, hashed assets, `manifest.webmanifest`, `sw.js`.
- [x] `bun --bun run preview`: app boots (verified via `curl`), no console errors observed from the server side; SPA-fallback route (`/habits`) returns 200 from `vite preview`.
- [ ] Log in with valid credentials at `/login`, confirm redirect to `/habits` (or `redirect` param target). (not manually verified in-browser)
- [ ] Reload `/habits` directly while logged in: brief pending state, then protected content, no login-page flash. (not manually verified in-browser)
- [ ] Log out via `TopBar` profile menu: redirect to `/login`, query cache cleared. (not manually verified in-browser)
- [ ] Unauthenticated direct navigation to `/finance`: redirect to `/login?redirect=/finance`. (not manually verified in-browser)
- [ ] DevTools → Application tab: manifest valid, service worker registered/active, installable. (not manually verified in-browser)
- [x] `bun run test` (39 passing, 1 pre-existing unrelated failure), `bun run lint` (0 errors, 2 pre-existing unrelated warnings), `bun run check` (clean on all files touched by this spec; 3 pre-existing unrelated formatting warnings on untouched shadcn files) all pass.

## Open Questions

- [ ] Should the SPA-fallback rewrite requirement be documented now as a deployment prerequisite (e.g. `docs/deployment.md` TODO), or deferred entirely to a future hosting-config spec? Still open — no `docs/deployment.md` exists yet.
- [x] Confirm `nitro`'s removal has no residual effect on the lockfile (transitive deps shared elsewhere) — diffed the lockfile after `bun install`; all removed packages are nitro's own transitive tree (cloud adapter SDKs, deployment presets), nothing shared/unrelated was removed.
