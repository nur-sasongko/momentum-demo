# Feature-First Architecture

This app uses **vertical slices colocated with routes** on TanStack Router, TanStack Query, and Zustand.

Related architecture docs:

- `docs/architecture/pwa.md` for installability and offline setup
- `docs/architecture/testing.md` for test runner setup, file placement, and coverage
- `docs/architecture/commit-workflow.md` for Husky hooks, staged checks, and commit message format
- Feature module docs: `docs/habits.md`, `docs/finance.md`, `docs/second-brain.md`

## Folder layout

```
src/
├── routes/
│   ├── __root.tsx                 # App shell, theme init, devtools
│   ├── index.tsx                  # / → redirects to /habits
│   ├── habits/
│   │   ├── index.tsx              # /habits
│   │   ├── -components/           # Feature-only UI
│   │   └── -utils/                # Feature-only helpers
│   ├── finance/
│   │   ├── index.tsx              # /finance
│   │   ├── -components/
│   │   └── -utils/
│   └── notes/
│       ├── index.tsx              # /notes
│       ├── -components/
│       └── -utils/
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

Pathless route groups like `(marketing)/` are optional. Current features use top-level route folders (`habits/`, `finance/`, `notes/`).

## Utility placement

| Scope               | Folder                         | Import                                         | Examples                                    |
| ------------------- | ------------------------------ | ---------------------------------------------- | ------------------------------------------- |
| Global (app-wide)   | `src/utils/`                   | `#/utils/<name>`                               | `formatTodayDate` in `date.ts`              |
| Feature-only        | `src/routes/<feature>/-utils/` | relative or `#/routes/<feature>/-utils/<name>` | `formatCurrency`, `getStreak`               |
| Framework / styling | `src/libs/`                    | `#/libs/<name>`                                | `cn()` in `utils.ts`, TanStack Query wiring |

> **Legacy note:** An earlier typo folder `src/utlis/` existed briefly. The canonical global folder is **`src/utils/`**. Do not add new modules under `src/utlis/`.

## Vertical slice folders

Colocate feature code next to its route files. TanStack Router ignores files and folders prefixed with `-`, so use:

| Folder         | Purpose                                    |
| -------------- | ------------------------------------------ |
| `-components/` | Feature-only React components              |
| `-utils/`      | Feature-only pure helpers and constants    |
| `-queries/`    | Query keys, `queryOptions`, loader helpers |
| `-mutations/`  | Mutations and server write helpers         |
| `-schemas/`    | Zod schemas and form validation            |
| `-types/`      | Types used only inside this feature        |
| `-tests/`      | Vitest tests for this feature              |

> **Note:** TanStack Router requires the `-` prefix for colocated non-route files. Do not use `_components/` — those would be treated as routes.

The `-utils/` prefix marks **route-scoped** helpers. Global helpers belong in `src/utils/`, not in a feature slice.

### Current examples

| Scope   | Path                                         | Consumer                                |
| ------- | -------------------------------------------- | --------------------------------------- |
| Global  | `src/utils/date.ts`                          | `TopBar.tsx`                            |
| Finance | `src/routes/finance/-utils/finance-utils.ts` | finance components + `finance-store.ts` |
| Habits  | `src/routes/habits/-utils/habit-utils.ts`    | habits components + `habits-store.ts`   |
| Notes   | `src/routes/notes/-utils/notes-utils.ts`     | notes components                        |

Feature utils stay in the route slice. Shared stores currently live in `src/stores/` and may import from `#/routes/<feature>/-utils/...`.

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

| Layer            | Location                            | Examples                                       |
| ---------------- | ----------------------------------- | ---------------------------------------------- |
| Framework wiring | `src/libs/`                         | TanStack Query provider, `cn()`                |
| Global helpers   | `src/utils/`                        | `formatTodayDate`                              |
| Feature UI       | `src/routes/<feature>/-components/` | `habit-card.tsx`, `note-editor.tsx`            |
| Feature helpers  | `src/routes/<feature>/-utils/`      | `formatCurrency`, `getStreak`                  |
| Client state     | `src/stores/`                       | Zustand + `persist` for habits, finance, notes |
| App shell        | `src/components/`                   | `AppShell`, `AppSidebar`, `TopBar`             |

## Promotion rules (feature → shared)

Keep code feature-local by default. Promote to shared only when the rule below is met:

| Code type        | Promote when            | Destination                                   |
| ---------------- | ----------------------- | --------------------------------------------- |
| UI component     | Used by **3+ features** | `src/components/`                             |
| Utility function | Used by **3+ features** | `src/utils/` (one file per concern)           |
| Type / constant  | Used by **3+ features** | `src/types/`                                  |
| Query / mutation | Used by **3+ features** | `src/libs/` or a dedicated `src/data/` module |
| Zustand store    | Used by **3+ features** | `src/stores/` (or extract shared slice first) |

App-shell helpers used across components (but not tied to one feature) may go directly into `src/utils/` without waiting for 3+ feature usage.

Before promoting, check that the abstraction is stable. Prefer duplicating small helpers over premature sharing.

## Adding a new feature

1. Add a route folder: `src/routes/<feature>/`
2. Add the route file: `index.tsx`
3. Add slice folders as needed (`-components/`, `-utils/`, `-queries/`, …)
4. Add a Zustand store in `src/stores/<feature>-store.ts` if the feature needs persisted client state
5. Register navigation in `src/components/AppSidebar.tsx`
6. Copy patterns from an existing slice such as `src/routes/habits/` or `src/routes/finance/`

When committing, use Conventional Commits with the feature name as scope (e.g. `feat(habits): add streak badge`). See `docs/architecture/commit-workflow.md`.

## Adding a global utility

1. Create `src/utils/<concern>.ts` (e.g. `date.ts`, `format.ts`)
2. Export pure functions with no feature-specific types when possible
3. Import via `#/utils/<concern>`
4. Write tests in `src/utils/__tests__/<concern>.test.ts`

When committing, use a global scope such as `globals` (e.g. `feat(globals): add shared utils date`). See `docs/architecture/commit-workflow.md`.

### Test placement summary

| Layer                      | Test location                        |
| -------------------------- | ------------------------------------ |
| Global utils               | `src/utils/__tests__/<name>.test.ts` |
| Feature utils / components | `src/routes/<feature>/-tests/`       |

Global utils use `__tests__/` (no dash — not a TanStack Router route folder). Route slices use `-tests/` to satisfy the TanStack Router file-prefix requirement.

## Migration strategy

1. New features follow this layout from day one.
2. Migrate existing routes when you touch them — no big-bang refactor.
3. Use `src/routes/habits/` as the reference implementation for slice colocation.
