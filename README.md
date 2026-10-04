# Momentum

A personal productivity app for tracking habits, finances, and notes, built with TanStack Start (React 19, SSR) and Supabase.

## Features

- **Habits** — track daily/weekly habits and streaks
- **Finance** — manage transactions and budgets
- **Notes** — rich-text notes powered by Tiptap
- Auth via Supabase, with protected routes and a persistent app shell (sidebar + top bar)
- Installable as a PWA

## Getting Started

Install dependencies and copy the env template:

```bash
bun install
cp .env.example .env
```

Fill in `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in `.env` (see `.env.example`).

Run the dev server:

```bash
bun --bun run dev
```

The app runs at [http://localhost:3000](http://localhost:3000).

> Use `bun --bun run <script>` for all scripts — the `--bun` flag ensures Bun's runtime is used instead of Node.

## Scripts

```bash
bun --bun run dev            # dev server at http://localhost:3000
bun --bun run build          # production build (also generates the service worker)
bun --bun run test           # run all tests (vitest run)
bun --bun run test:coverage  # run tests with istanbul coverage report
bun --bun run lint           # eslint
bun --bun run format         # prettier --write + eslint --fix
bun --bun run check          # prettier --check (CI)
```

Run a single test file:

```bash
bunx vitest run src/path/to/file.test.ts
```

Add a Shadcn component:

```bash
bunx --bun shadcn@latest add <component>
```

## Architecture

Momentum is a **TanStack Start SSR app** — React 19 with server-side rendering. Key pieces:

- **Routing** — file-based routing via `@tanstack/react-router` (`src/routes/`). `/habits`, `/finance`, `/notes` sit under the `_authenticated` layout, which requires a logged-in user and renders the app shell (sidebar/top bar). Public routes like `/login` and `/(marketing)/about` render without that chrome.
- **Feature-first layout** — each feature is a vertical slice colocated with its route (`-components/`, `-utils/`, `-queries/`, etc). See [`docs/architecture/feature-slices.md`](docs/architecture/feature-slices.md).
- **Data & state** — TanStack Query for server state (SSR-safe via `setupRouterSsrQueryIntegration`), Zustand for persisted client state (`src/stores/`).
- **Styling** — Tailwind CSS v4 with CSS variables for theming; Shadcn components (new-york style, zinc base color).
- **Backend** — Supabase (Postgres + Auth). All Supabase access goes through client factories in `src/libs/supabase/` and the auth adapter in `src/libs/auth/auth-adapter.ts` — never import `@supabase/supabase-js` directly elsewhere. See [`docs/specs/202607041542-core-platform.md#spec-202607041542`](docs/specs/202607041542-core-platform.md#spec-202607041542) and [`docs/specs/202607041542-core-platform.md#spec-202607041543`](docs/specs/202607041542-core-platform.md#spec-202607041543).
- **PWA** — see [`docs/architecture/pwa.md`](docs/architecture/pwa.md).

Full guidance for contributing with Claude Code lives in [`CLAUDE.md`](CLAUDE.md).

## Specs

Feature work is documented as specs under `docs/specs/`. Use `/spec "description"` to scaffold a new one — see [`docs/architecture/spec-workflow.md`](docs/architecture/spec-workflow.md) for the lifecycle and conventions.

## Changelog

See [`CHANGELOG.md`](CHANGELOG.md) for release history — see [`docs/architecture/changelog-workflow.md`](docs/architecture/changelog-workflow.md) for how it's maintained.
