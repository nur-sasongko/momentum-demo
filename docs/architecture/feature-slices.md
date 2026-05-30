# Feature-First Architecture

This app uses **vertical slices colocated with routes** on TanStack Router, TanStack Query, and Zustand.

Related architecture docs:

- `docs/architecture/pwa.md` for installability and offline setup
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
├── libs/
│   ├── utils.ts                   # Shared utilities (e.g. cn())
│   └── tanstack-query/            # QueryClient + devtools wiring
└── types/                         # Shared types (create when needed)
```

Pathless route groups like `(marketing)/` are optional. Current features use top-level route folders (`habits/`, `finance/`, `notes/`).

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

### Current examples

| Feature | Utils | Store |
| ------- | ----- | ----- |
| Finance | `src/routes/finance/-utils/finance-utils.ts` | `src/stores/finance-store.ts` |
| Habits  | `src/routes/habits/-utils/habit-utils.ts`    | `src/stores/habits-store.ts`  |
| Notes   | `src/routes/notes/-utils/notes-utils.ts`     | `src/stores/notes-store.ts`   |

Feature utils stay in the route slice. Shared stores currently live in `src/stores/` and may import from `#/routes/<feature>/-utils/...`.

## Route file responsibilities

Route files (`index.tsx`, etc.) should only:

1. Call `createFileRoute` with path, loader, and component
2. Wire loaders to `-queries/` (or `-mutations/` for actions)
3. Render feature components from `-components/`

Keep business logic, UI markup, and data fetching out of route files.

## Imports

- Prefer `#/*` for cross-slice imports (`#/components/ui/button`, `#/stores/finance-store`)
- Use relative imports inside a feature slice (`./-components/habit-card`, `../-utils/finance-utils`)
- Stores importing feature helpers: `#/routes/<feature>/-utils/<name>`

## Shared vs feature-local code

| Layer | Location | Examples |
| ----- | -------- | -------- |
| Framework wiring | `src/libs/` | TanStack Query provider, `cn()` |
| Feature UI | `src/routes/<feature>/-components/` | `habit-card.tsx`, `note-editor.tsx` |
| Feature helpers | `src/routes/<feature>/-utils/` | `formatCurrency`, `getStreak` |
| Client state | `src/stores/` | Zustand + `persist` for habits, finance, notes |
| App shell | `src/components/` | `AppShell`, `AppSidebar`, `TopBar` |

## Promotion rules (feature → shared)

Keep code feature-local by default. Promote to shared only when the rule below is met:

| Code type        | Promote when            | Destination                                           |
| ---------------- | ----------------------- | ----------------------------------------------------- |
| UI component     | Used by **3+ features** | `src/components/`                                     |
| Utility function | Used by **3+ features** | `src/libs/`                                           |
| Type / constant  | Used by **3+ features** | `src/types/`                                          |
| Query / mutation | Used by **3+ features** | `src/libs/` or a dedicated `src/data/` module         |
| Zustand store    | Used by **3+ features** | `src/stores/` (or extract shared slice first)         |

Before promoting, check that the abstraction is stable. Prefer duplicating small helpers over premature sharing.

## Adding a new feature

1. Add a route folder: `src/routes/<feature>/`
2. Add the route file: `index.tsx`
3. Add slice folders as needed (`-components/`, `-utils/`, `-queries/`, …)
4. Add a Zustand store in `src/stores/<feature>-store.ts` if the feature needs persisted client state
5. Register navigation in `src/components/AppSidebar.tsx`
6. Copy patterns from an existing slice such as `src/routes/habits/` or `src/routes/finance/`

## Migration strategy

1. New features follow this layout from day one.
2. Migrate existing routes when you touch them — no big-bang refactor.
3. Use `src/routes/habits/` as the reference implementation for slice colocation.
