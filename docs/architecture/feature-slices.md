# Feature-First Architecture

This app uses **route groups + vertical slices** with TanStack Router and TanStack Query.

Related architecture docs:

- `docs/architecture/pwa.md` for installability and offline setup

## Folder layout

```
src/
├── routes/
│   ├── __root.tsx                 # App shell (global)
│   └── (marketing)/               # Pathless route group — not in URL
│       ├── index.tsx              # /
│       └── about/
│           ├── index.tsx          # /about
│           ├── -components/       # Feature-only UI
│           ├── -queries/          # Query keys + query options
│           ├── -mutations/        # Writes / server actions
│           ├── -schemas/          # Zod validation
│           ├── -types/            # Feature-only types
│           └── -tests/            # Feature tests
├── components/
│   └── ui/                        # Shared Shadcn primitives
├── integrations/                  # Cross-cutting framework wiring
├── lib/                           # Shared utilities
└── types/                         # Shared types (create when needed)
```

### Route groups

Use `(groupName)/` for organization only. Parentheses are **pathless** — they do not appear in URLs.

Examples: `(marketing)/`, `(dashboard)/`, `(settings)/`.

Start with 2–3 groups that match real product areas. Avoid empty groups.

### Vertical slice folders

Colocate feature code next to its route files. TanStack Router ignores files and folders prefixed with `-`, so use:

| Folder         | Purpose                                    |
| -------------- | ------------------------------------------ |
| `-components/` | Feature-only React components              |
| `-queries/`    | Query keys, `queryOptions`, loader helpers |
| `-mutations/`  | Mutations and server write helpers         |
| `-schemas/`    | Zod schemas and form validation            |
| `-types/`      | Types used only inside this feature        |
| `-tests/`      | Vitest tests for this feature              |

> **Note:** TanStack Router requires the `-` prefix for colocated non-route files. Do not use `_components/` — those would be treated as routes.

## Route file responsibilities

Route files (`index.tsx`, `about.tsx`, etc.) should only:

1. Call `createFileRoute` with path, loader, and component
2. Wire loaders to `-queries/` (or `-mutations/` for actions)
3. Render feature components from `-components/`

Keep business logic, UI markup, and data fetching out of route files.

## Imports

- Prefer `#/*` for all internal imports (`#/components/ui/button`)
- Use relative imports only inside a feature slice (`./-components/about-hero`)

## Promotion rules (feature → shared)

Keep code feature-local by default. Promote to shared only when the rule below is met:

| Code type        | Promote when            | Destination                                           |
| ---------------- | ----------------------- | ----------------------------------------------------- |
| UI component     | Used by **3+ features** | `src/components/`                                     |
| Utility function | Used by **3+ features** | `src/lib/`                                            |
| Type / constant  | Used by **3+ features** | `src/types/`                                          |
| Query / mutation | Used by **3+ features** | `src/integrations/` or a dedicated `src/data/` module |

Before promoting, check that the abstraction is stable. Prefer duplicating small helpers over premature sharing.

## Adding a new feature

1. Pick or create a route group: `src/routes/(dashboard)/projects/`
2. Add the route file: `index.tsx` or `detail.$id.tsx`
3. Add slice folders as needed (`-components/`, `-queries/`, …)
4. Register navigation links in `src/components/Header.tsx`
5. Copy patterns from the reference slice: `src/routes/(marketing)/about/`

## Migration strategy

1. New features follow this layout from day one.
2. Migrate existing routes when you touch them — no big-bang refactor.
3. Use `(marketing)/about/` as the reference implementation.
