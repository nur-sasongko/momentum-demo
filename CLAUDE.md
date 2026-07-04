# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

Use `bun --bun run` for all scripts (the `--bun` flag ensures Bun's runtime is used instead of Node):

```bash
bun --bun run dev       # dev server at http://localhost:3000
bun --bun run build     # production build
bun --bun run test          # run all tests (vitest run) — do NOT use `bun test` (that is Bun's native runner, not Vitest)
bun --bun run test:coverage # run tests with istanbul coverage report
bun --bun run lint      # eslint
bun --bun run format    # prettier --write + eslint --fix
bun --bun run check     # prettier --check (CI)
```

Run a single test file:

```bash
bunx vitest run src/path/to/file.test.ts
```

See [`docs/architecture/testing.md`](docs/architecture/testing.md) for test placement conventions, coverage setup, and writing guidelines.

Add a Shadcn component:

```bash
bunx --bun shadcn@latest add <component>
```

## Architecture

**TanStack Start SSR app** — React 19 with server-side rendering via `@tanstack/react-start`. The Vite config (`vite.config.ts`) wires together TanStack Start, React, and Tailwind CSS v4 plugins.

### Routing

File-based routing via `@tanstack/react-router`. Drop a file in `src/routes/` and the router plugin auto-generates `src/routeTree.gen.ts` — never edit that file manually. The root layout (`src/routes/__root.tsx`) resolves the current user (`beforeLoad`) and wraps all routes with theme initialization and devtools panels only — it does not render app chrome.

`/habits`, `/finance`, `/notes` are nested under the `_authenticated` pathless layout (`src/routes/_authenticated.tsx`), which redirects unauthenticated visitors to `/login` and renders `<AppShell>` (sidebar/`TopBar` chrome). Public routes like `/login` and `/(marketing)/about` sit outside `_authenticated` and render without that chrome.

Feature-first layout: vertical slices (`-components/`, `-utils/`, `-queries/`, etc.) colocated with route files. Current features: `/habits`, `/finance`, `/notes`. See [`docs/architecture/feature-slices.md`](docs/architecture/feature-slices.md) for conventions and promotion rules.

### Utils

- **Global helpers** — `src/utils/` for app-wide pure functions (e.g. `date.ts` → `#/utils/date`). One concern per file.
- **Feature helpers** — `src/routes/<feature>/-utils/` for route-scoped logic (e.g. `finance-utils.ts`).
- **Framework / styling** — `src/libs/` for TanStack Query wiring and Shadcn `cn()` (`#/libs/utils`).

> Legacy: `src/utlis/` was a typo; use `src/utils/` for all new global utilities.

### Data & State

- **TanStack Query** — `QueryClient` is created in `src/libs/tanstack-query/root-provider.tsx` and injected into the router context (`src/router.tsx`). SSR integration is set up via `setupRouterSsrQueryIntegration`, which makes queries SSR-safe without extra boilerplate.
- **Zustand** — persisted client state in `src/stores/` (e.g. `habits-store.ts`, `finance-store.ts`, `notes-store.ts`). Feature helpers live in `src/routes/<feature>/-utils/`.
- Route loaders (via `loader:` in `createFileRoute`) are the preferred way to fetch data for a route before it renders.

### Path Aliases

`#/*` resolves to `src/*` (defined in both `package.json` `imports` and `tsconfig.json`). `@/*` is also available but `#/*` is preferred. Shadcn aliases (`#/components/ui`, `#/libs/utils`, `#/hooks`) follow this convention. Global utilities import via `#/utils/<name>`.

### Styling

Tailwind CSS v4 with CSS variables for theming. Global styles in `src/styles.css`. The `cn()` helper in `src/libs/utils.ts` (clsx + tailwind-merge) is the standard way to compose class names. Shadcn components use the **new-york** style with **zinc** base color.

### Theme System

Dark/light/auto theme cycling (light → dark → auto), persisted in `localStorage`. An inline `<script>` in `__root.tsx` (`THEME_INIT_SCRIPT`) applies the stored theme before hydration to prevent flash of unstyled content. Theme state lives entirely in `ThemeToggle.tsx` — there is no global store for it.

### Backend / Supabase

- Env vars (`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`) are validated at import-time by `src/libs/env.ts` (`#/libs/env`) — fails fast with a clear error if missing/invalid. See `.env.example`.
- Supabase client factories live in `src/libs/supabase/`: `client.ts` (`getSupabaseBrowserClient()`, memoized per tab) and `server.ts` (`getSupabaseServerClient()`, one instance per request, wired to TanStack Start's `getCookies`/`setCookie`). Route/component code should never import `@supabase/supabase-js`/`@supabase/ssr` directly — always go through these factories or the auth adapter to keep the app portable to a self-hosted Supabase instance or a different backend later. See [`docs/specs/core-supabase-postgres.md`](docs/specs/core-supabase-postgres.md).
- Auth adapter — `src/libs/auth/auth-adapter.ts` (`#/libs/auth/auth-adapter`) exposes `signInWithPassword`, `signOut`, `getUser`, `getSession`; the only file (besides the client factories above) that touches Supabase auth APIs directly. `getUser()`'s server branch revalidates against Supabase Auth (the real security boundary, used in the root `beforeLoad`); its client branch reads the local session cookie only (`getSession()`), avoiding a network round-trip on every SPA navigation. See [`docs/specs/core-auth-login-logout.md`](docs/specs/core-auth-login-logout.md).

### PWA

- PWA architecture details live in `docs/architecture/pwa.md`.
- Build command `bun --bun run build` must generate `dist/client/sw.js` via `scripts/generate-sw.ts` (post-build step).
- If installability regresses, verify `src/routes/__root.tsx` still includes manifest/theme/icon head tags and check browser Application -> Manifest diagnostics.

## Specs

Use `/spec "description"` to scaffold a new spec file from the template. See [`docs/architecture/spec-workflow.md`](docs/architecture/spec-workflow.md) for when to write a spec, the lifecycle, naming convention, and commit conventions.
