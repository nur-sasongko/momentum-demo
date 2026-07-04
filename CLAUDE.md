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

**Static SPA** — React 19 client-rendered via `@tanstack/react-router` (no SSR — see [`docs/specs/core-remove-ssr.md`](docs/specs/core-remove-ssr.md)). Entry point is `index.html` → `src/entry-client.tsx`, which mounts `RouterProvider`. The Vite config (`vite.config.ts`) wires together the TanStack Router plugin (route generation), React, and Tailwind CSS v4 plugins. `vite build` produces a flat static `dist/` deployable to any static host (with SPA-fallback rewrites configured).

### Routing

File-based routing via `@tanstack/react-router`. Drop a file in `src/routes/` and the router plugin auto-generates `src/routeTree.gen.ts` — never edit that file manually. The root layout (`src/routes/__root.tsx`) resolves the current user (`beforeLoad`, client-only session check) and renders devtools panels and the toaster only — it does not render app chrome or document head tags (those live in `index.html`).

`/habits`, `/finance`, `/notes` are nested under the `_authenticated` pathless layout (`src/routes/_authenticated.tsx`), which redirects unauthenticated visitors to `/login` and renders `<AppShell>` (sidebar/`TopBar` chrome). Public routes like `/login` and `/(marketing)/about` sit outside `_authenticated` and render without that chrome.

Feature-first layout: vertical slices (`-components/`, `-utils/`, `-queries/`, etc.) colocated with route files. Current features: `/habits`, `/finance`, `/notes`. See [`docs/architecture/feature-slices.md`](docs/architecture/feature-slices.md) for conventions and promotion rules.

### Utils

- **Global helpers** — `src/utils/` for app-wide pure functions (e.g. `date.ts` → `#/utils/date`). One concern per file.
- **Feature helpers** — `src/routes/<feature>/-utils/` for route-scoped logic (e.g. `finance-utils.ts`).
- **Framework / styling** — `src/libs/` for TanStack Query wiring and Shadcn `cn()` (`#/libs/utils`).

> Legacy: `src/utlis/` was a typo; use `src/utils/` for all new global utilities.

### Data & State

- **TanStack Query** — `QueryClient` is created in `src/libs/tanstack-query/root-provider.tsx`, injected into the router context, and provided to the tree via the router's `Wrap` option (`src/router.tsx`), which renders `QueryClientProvider`.
- **Zustand** — persisted client state in `src/stores/` (e.g. `habits-store.ts`, `finance-store.ts`, `notes-store.ts`). Feature helpers live in `src/routes/<feature>/-utils/`.
- Route loaders (via `loader:` in `createFileRoute`) are the preferred way to fetch data for a route before it renders.

### Path Aliases

`#/*` resolves to `src/*` (defined in both `package.json` `imports` and `tsconfig.json`). `@/*` is also available but `#/*` is preferred. Shadcn aliases (`#/components/ui`, `#/libs/utils`, `#/hooks`) follow this convention. Global utilities import via `#/utils/<name>`.

### Styling

Tailwind CSS v4 with CSS variables for theming. Global styles in `src/styles.css`. The `cn()` helper in `src/libs/utils.ts` (clsx + tailwind-merge) is the standard way to compose class names. Shadcn components use the **new-york** style with **zinc** base color.

### Theme System

Dark/light/auto theme cycling (light → dark → auto), persisted in `localStorage`. An inline `<script>` in `index.html` (kept in sync with `THEME_INIT_SCRIPT` in `src/hooks/use-theme.ts`) applies the stored theme before first paint to prevent flash of unstyled content. Theme state lives entirely in `ThemeToggle.tsx` — there is no global store for it.

### Backend / Supabase

- Env vars (`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`) are validated at import-time by `src/libs/env.ts` (`#/libs/env`) — fails fast with a clear error if missing/invalid. See `.env.example`.
- The Supabase client factory lives at `src/libs/supabase/client.ts` (`getSupabaseBrowserClient()`, memoized per tab, `@supabase/supabase-js`'s browser client with localStorage-based sessions). Route/component code should never import `@supabase/supabase-js` directly — always go through this factory or the auth adapter to keep the app portable to a self-hosted Supabase instance or a different backend later. See [`docs/specs/core-supabase-postgres.md`](docs/specs/core-supabase-postgres.md).
- Auth adapter — `src/libs/auth/auth-adapter.ts` (`#/libs/auth/auth-adapter`) exposes `signInWithPassword`, `signOut`, `getUser`, `getSession`; the only file (besides the client factory above) that touches Supabase auth APIs directly. Both `getUser()` and `getSession()` are client-only — there is no server-side revalidation (no SSR, no remote app data to gate; see [`docs/specs/core-remove-ssr.md`](docs/specs/core-remove-ssr.md)). See [`docs/specs/core-auth-login-logout.md`](docs/specs/core-auth-login-logout.md).

### PWA

- PWA architecture details live in `docs/architecture/pwa.md`.
- Build command `bun --bun run build` must generate `dist/sw.js` via `scripts/generate-sw.ts` (post-build step).
- If installability regresses, verify `index.html` still includes manifest/theme/icon head tags and check browser Application -> Manifest diagnostics.

## Specs

Use `/spec "description"` to scaffold a new spec file from the template. See [`docs/architecture/spec-workflow.md`](docs/architecture/spec-workflow.md) for when to write a spec, the lifecycle, naming convention, and commit conventions.
