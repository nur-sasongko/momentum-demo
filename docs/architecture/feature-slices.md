# Feature-First Architecture

This app uses **vertical slices colocated with routes** on TanStack Router, TanStack Query, and Zustand.

Related architecture docs:

- `docs/architecture/pwa.md` for installability and offline setup
- `docs/architecture/testing.md` for test runner setup, file placement, and coverage
- `docs/architecture/commit-workflow.md` for Husky hooks, staged checks, and commit message format
- Feature module docs: `docs/habits.md`, `docs/finance.md`, `docs/second-brain.md` (Notion-style Tiptap notes editor)

## Folder layout

```
src/
├── routes/
│   ├── __root.tsx                 # App shell, theme init, devtools
│   ├── index.tsx                  # / → redirects to /habits
│   └── _authenticated/
│       ├── habits/
│       │   ├── index.tsx          # /habits
│       │   ├── -components/       # Feature-only UI
│       │   └── -utils/            # Feature-only helpers
│       ├── finance/
│       │   ├── index.tsx          # /finance
│       │   ├── -components/
│       │   ├── -types/            # Data types crossing module boundaries in this slice
│       │   └── -utils/
│       ├── notes/
│       │   ├── index.tsx          # /notes
│       │   ├── -components/
│       │   ├── -types/
│       │   └── -utils/
│       └── tasks/
│           ├── index.tsx          # /tasks
│           ├── -components/
│           └── -utils/
├── components/
│   ├── AppShell.tsx               # Sidebar + top bar layout
│   ├── AppSidebar.tsx
│   ├── TopBar.tsx
│   ├── ThemeToggle.tsx
│   └── ui/                        # Shared Shadcn primitives
├── stores/                        # Zustand stores (persisted client state)
├── hooks/                         # Shared React hooks
├── utils/                         # Global shared helpers (one concern per file)
│   ├── date.ts                    # e.g. formatTodayDate for TopBar
│   └── __tests__/                 # Unit tests for global utils
│       └── date.test.ts
├── libs/
│   ├── utils.ts                   # Shadcn cn() helper only
│   └── tanstack-query/            # QueryClient + devtools wiring
└── types/                         # Shared types (create when needed)
```

Pathless route groups like `(marketing)/` are optional. Current features (`habits/`, `finance/`, `notes/`, `tasks/`) live under the `_authenticated` pathless layout.

## Utility placement

| Scope               | Folder                         | Import                                         | Examples                                    |
| ------------------- | ------------------------------ | ---------------------------------------------- | ------------------------------------------- |
| Global (app-wide)   | `src/utils/`                   | `#/utils/<name>`                               | `formatTodayDate` in `date.ts`              |
| Feature-only        | `src/routes/<feature>/-utils/` | relative or `#/routes/<feature>/-utils/<name>` | `getStreak`                                 |
| Framework / styling | `src/libs/`                    | `#/libs/<name>`                                | `cn()` in `utils.ts`, TanStack Query wiring |

## Vertical slice folders

Colocate feature code next to its route files. TanStack Router ignores files and folders prefixed with `-`, so use:

| Folder                | Purpose                                                                 |
| --------------------- | ----------------------------------------------------------------------- |
| `-components/`        | Feature-only React components                                           |
| `-utils/`             | Feature-only pure helpers and constants                                 |
| `-queries/`           | Query keys, `queryOptions`, loader helpers                              |
| `-mutations/`         | Mutations and server write helpers                                      |
| `-schemas/`           | Zod schemas and form validation                                         |
| `-types/`             | Data types that cross module boundaries inside this feature — see below |
| `<concern>/__test__/` | Vitest tests colocated in each concern folder                           |

> **Note:** TanStack Router requires the `-` prefix for colocated non-route files. Do not use `_components/` — those would be treated as routes.

The `-utils/` prefix marks **route-scoped** helpers. Global helpers belong in `src/utils/`, not in a feature slice.

### What goes in `-types/`

A type moves to `-types/` when it describes **data that crosses module boundaries inside the slice** — a Supabase response row, a query's params/result, a value passed between components that don't otherwise import each other. It stays where it is when it is the **API of the module it lives in** (component `Props`/`Ref`, a hook's return type) or is **derived from a value in that module** (`z.infer<typeof schema>`, `(typeof CONST)[number]`, a function's own return type) — moving those would either invert the module's dependency direction or split a schema from the unions it validates.

`-types/` stays one-way-dependent: it may import from `#/stores/` and `#/types/`, never from `-utils/` or `-components/`. A type that would need to reach into `-utils/` (e.g. to reuse a schema-adjacent union) inlines the small piece it needs instead, with a comment explaining why — see `src/routes/_authenticated/finance/-types/finance-query.ts`.

`src/routes/_authenticated/finance/-types/` and `src/routes/_authenticated/notes/-types/` are the reference implementation ([`docs/specs/019-core-feature-types-folders.md`](../specs/019-core-feature-types-folders.md)). Not every feature needs one — `habits` and `tasks` currently export too few slice-local types to justify the folder; add it when the same pressure shows up there.

### Current examples

| Scope   | Path                                                                               | Consumer                                                        |
| ------- | ---------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| Global  | `src/utils/date.ts`                                                                | `TopBar.tsx`, finance, habits, notes                            |
| Finance | `src/routes/_authenticated/finance/-utils/finance-utils.ts`                        | finance components + `finance-store.ts`                         |
| Habits  | `src/routes/_authenticated/habits/-utils/habit-utils.ts`                           | habits components + `habits-store.ts`                           |
| Notes   | `src/routes/_authenticated/notes/-utils/notes-utils.ts`, `tiptap-extensions.ts`    | notes components + `notes-store.ts`; see `docs/second-brain.md` |
| Tasks   | `src/routes/_authenticated/tasks/-utils/tasks-utils.ts`, `notification-service.ts` | tasks components + `tasks-store.ts`                             |

Feature utils stay in the route slice. Shared stores currently live in `src/stores/` and may import from `#/routes/<feature>/-utils/...`.

## Shareable filter state (URL search params)

When a feature needs filters that should be bookmarkable/shareable and undoable via Back, put them in validated route search params instead of a Zustand store, and wrap read/write access in one feature hook (e.g. `useFinanceFilters`) rather than calling `useSearch`/`useNavigate` from every consumer. See `src/routes/_authenticated/finance/-utils/finance-search.ts` and `-utils/use-finance-filters.ts` for the reference implementation ([`docs/specs/011-finance-filters-url-state.md`](../specs/011-finance-filters-url-state.md)), and `src/routes/_authenticated/notes/-utils/notes-route-search.ts` and `-utils/use-notes-filters.ts` for a second implementation of the same pattern ([`docs/specs/016-notes-filters-url-state.md`](../specs/016-notes-filters-url-state.md)). Both hooks share the same `apply(patch, opts)` navigate wrapper and the same array-toggle boundary heuristic — see `toggleArrayValue` in `#/utils/search-params`.

## Route file responsibilities

Route files (`index.tsx`, etc.) should only:

1. Call `createFileRoute` with path, loader, and component
2. Wire loaders to `-queries/` (or `-mutations/` for actions)
3. Render feature components from `-components/`

Keep business logic, UI markup, and data fetching out of route files.

## Imports

- Prefer `#/*` for cross-slice imports (`#/components/ui/button`, `#/stores/finance-store`, `#/utils/date`)
- Use relative imports inside a feature slice (`./-components/habit-card`, `../-utils/finance-utils`)
- Stores importing feature helpers: `#/routes/<feature>/-utils/<name>`

## Shared vs feature-local code

| Layer            | Location                            | Examples                                                                   |
| ---------------- | ----------------------------------- | -------------------------------------------------------------------------- |
| Framework wiring | `src/libs/`                         | TanStack Query provider, `cn()`                                            |
| Global helpers   | `src/utils/`                        | `formatTodayDate`                                                          |
| Feature UI       | `src/routes/<feature>/-components/` | `habit-card.tsx`, `note-editor.tsx`, `tiptap-editor.tsx`, `task-board.tsx` |
| Feature helpers  | `src/routes/<feature>/-utils/`      | `getStreak`                                                                |
| Feature types    | `src/routes/<feature>/-types/`      | `TransactionRow`, `NotesListParams` — see "What goes in `-types/`" above   |
| Client state     | `src/stores/`                       | Zustand + `persist` for habits, finance, notes, tasks                      |
| App shell        | `src/components/`                   | `AppShell`, `AppSidebar`, `TopBar`                                         |

## Promotion rules (feature → shared)

Keep code feature-local by default. Promote to shared when **either** condition below is met:

| Condition                                                                                          | Code type        | Destination                                   |
| -------------------------------------------------------------------------------------------------- | ---------------- | --------------------------------------------- |
| Verbatim/near-verbatim duplicated in **2+ features**                                               | UI component     | `src/components/`                             |
| Verbatim/near-verbatim duplicated in **2+ features**                                               | Utility function | `src/utils/` (one file per concern)           |
| Verbatim/near-verbatim duplicated in **2+ features**                                               | Type / constant  | `src/types/`                                  |
| Verbatim/near-verbatim duplicated in **2+ features**                                               | Query / mutation | `src/libs/` or a dedicated `src/data/` module |
| Verbatim/near-verbatim duplicated in **2+ features**                                               | Zustand store    | `src/stores/` (or extract shared slice first) |
| Provably domain-free (no feature types, no feature imports) — regardless of current consumer count | Any of the above | Same destinations                             |

App-shell helpers used across components (but not tied to one feature) may go directly into `src/utils/` without waiting for a second consumer.

Before promoting, check two things:

1. **The abstraction is stable.** Prefer duplicating small helpers over premature sharing.
2. **The call sites actually agree.** If they disagree on presentation (different container, different sizing, different copy), promoting silently changes what a user sees at whichever sites don't match the extracted shape — that is a design decision wearing a refactor's clothes. Align the call sites visually first, in their own commit, then extract.

This app already applies the domain-free half of the rule in practice: `src/components/location/`, `src/types/location.ts`, `src/utils/location.ts` (spec 006), and `src/components/markdown/` (spec 007) are all domain-free and were placed here while used by finance alone. Treat them as reference examples, not exceptions.

## Adding a new feature

1. Add a route folder: `src/routes/_authenticated/<feature>/`
2. Add the route file: `index.tsx`
3. Add slice folders as needed (`-components/`, `-utils/`, `-queries/`, …)
4. Add a Zustand store in `src/stores/<feature>-store.ts` if the feature needs persisted client state
5. Register navigation in `src/components/AppSidebar.tsx`
6. Copy patterns from an existing slice such as `src/routes/_authenticated/habits/` or `src/routes/_authenticated/finance/`

When committing, use Conventional Commits with the feature name as scope (e.g. `feat(habits): add streak badge`). See `docs/architecture/commit-workflow.md`.

## Adding a global utility

1. Create `src/utils/<concern>.ts` (e.g. `date.ts`, `format.ts`)
2. Export pure functions with no feature-specific types when possible
3. Import via `#/utils/<concern>`
4. Write tests in `src/utils/__tests__/<concern>.test.ts`

When committing, use a global scope such as `globals` (e.g. `feat(globals): add shared utils date`). See `docs/architecture/commit-workflow.md`.

### Test placement summary

| Layer              | Test location                                               |
| ------------------ | ----------------------------------------------------------- |
| Global utils       | `src/utils/__tests__/<name>.test.ts`                        |
| Feature components | `src/routes/<feature>/-components/__test__/<name>.test.tsx` |
| Feature utils      | `src/routes/<feature>/-utils/__test__/<name>.test.ts`       |

Global utilities keep `__tests__/`. Feature tests should be colocated by concern (`-components/__test__/`, `-utils/__test__/`, etc.) instead of a feature-level `-tests/` folder. `-types/` is the exception: type-only modules emit no runtime, so they get no `__test__/` folder and are excluded from coverage (`vitest.config.ts`'s `coverage.exclude`).

## Migration strategy

1. New features follow this layout from day one.
2. Migrate existing routes when you touch them — no big-bang refactor.
3. Use `src/routes/_authenticated/habits/` as the reference implementation for slice colocation.
