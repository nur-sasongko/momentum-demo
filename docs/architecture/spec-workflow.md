# Spec-Driven Development Workflow

Related architecture docs:

- [`docs/architecture/feature-slices.md`](feature-slices.md) — slice layout and scope naming
- [`docs/architecture/commit-workflow.md`](commit-workflow.md) — commit message conventions
- [`docs/specs/_template.md`](../specs/_template.md) — the spec template
- [`docs/specs/_index.md`](../specs/_index.md) — the spec registry

## What is a spec?

A spec is a forward-looking markdown file that captures the problem, design decisions, acceptance criteria, and implementation plan for a non-trivial feature before coding begins. Specs live in `docs/specs/` and use the template at `docs/specs/_template.md`.

Specs are distinct from feature docs (`docs/habits.md`, `docs/finance.md`, `docs/second-brain.md`), which describe the **current state** of each feature. When a spec reaches `done`, its relevant sections are merged into the corresponding feature doc to keep it up to date.

## When to write a spec

Write a spec for any change that requires at least one of:

- A new user-visible feature (new UI, new route, new modal/sheet)
- A data model change (new field on a Zustand store, new store, version bump)
- A design decision with multiple valid approaches
- Work that spans more than one day or one sitting
- Something you would want to discuss before starting

Skip a spec for:

- Small bugfixes (a null check, an off-by-one, a broken layout on one breakpoint)
- Styling tweaks (color, spacing, font size, dark mode adjustments)
- Copy changes (label text, placeholder text, error messages)
- Dependency upgrades with no API changes

If you are unsure, err toward writing a lightweight spec. Template sections are opt-in — leave sections as "N/A" for smaller features.

## Spec lifecycle

```
draft → in-progress → done
              ↓
          cancelled
```

| Status        | Meaning                                                        |
| ------------- | -------------------------------------------------------------- |
| `draft`       | Being written; not ready for implementation                    |
| `in-progress` | Actively being built; spec is locked except for clarifications |
| `done`        | Shipped; feature doc updated                                   |
| `cancelled`   | Decided not to build; kept for historical context              |

Update the `status` field (in the frontmatter, or on a part's `**Status:**` line) at each transition, then run `bun --bun run specs:index`. Update the `updated` date whenever the spec changes.

## IDs

A spec's id is its **UTC creation timestamp** in `YYYYMMDDHHmm` form (e.g. `202610041316`), generated with:

```bash
date -u +%Y%m%d%H%M
```

Timestamp ids let developers create specs on parallel branches without colliding on "the next number". The `id` frontmatter field, the filename prefix, and the `#spec-<id>` anchor all use the same value. Ids are never changed or reused.

Specs written before timestamp ids keep their old sequential number as `legacy-id` (or `**Legacy ID:**` on a part). Older prose still says things like "spec 024" or "after `025`". Look those numbers up in the **Legacy** column of `docs/specs/_index.md`.

## The index is generated

`docs/specs/_index.md` and the part table of each consolidated file are **generated** from spec frontmatter by `scripts/generate-spec-index.ts`. Never edit them by hand.

```bash
bun --bun run specs:index   # rewrite the index and part tables
bun --bun run specs:check   # exit 1 if they are stale (use in CI)
```

The script also checks that ids are 12-digit timestamps, unique, and match the filename, and that statuses are valid. If two branches both touch `_index.md`, resolve the conflict by taking either side and re-running `specs:index`.

## Naming convention

```
docs/specs/<id>-<feature>-<description>.md
```

- `<id>` is the spec's timestamp id (see [IDs](#ids)). Because it comes first, the directory listing stays sorted in creation order
- `<feature>` must be one of: `habits`, `finance`, `notes`, `tasks`, `core`
- `<description>` is a short kebab-case summary of what is being specced
- Use `core-` for shared infrastructure: `AppShell`, `AppSidebar`, `src/stores/` patterns, `src/utils/`, PWA, routing, or anything that touches more than one feature area

Examples:

```
docs/specs/202610051420-habits-streak-freeze.md
docs/specs/202610061103-finance-recurring-transactions.md
docs/specs/202610070915-core-global-search.md
```

**Cross-feature specs:** when a spec genuinely spans two features, use `core-` as the prefix and add `related-features` to the frontmatter:

```yaml
feature: core
related-features: [habits, finance]
```

## Consolidated spec files

To keep `docs/specs/` small, closely related specs share one file. For example, `202607300500-finance-charts.md` holds three chart specs. A consolidated file:

- Has frontmatter whose `id` is its first part's id, and is named after that id plus the theme it covers. `consolidates: [...]` lists every part's id. Its `status` is the least-finished status among its parts (`specs:index` keeps both fields in sync).
- Opens with a generated part table between `<!-- spec-parts:start -->` and `<!-- spec-parts:end -->`, then one part per spec, separated by `---`.
- Starts each part with exactly this header, which the generator parses:

  ```md
  <a id="spec-202610041316"></a>

  ## 202610041316 — Part Title

  **Status:** draft · **Created:** 2026-10-04 · **Updated:** 2026-10-04
  ```

  The template's sections sit one level down (`### Problem Statement`, `### Amendments`, …).

Each part keeps its own id, status, and row in the index. Link to a part as `<file>.md#spec-<id>`.

## Creating a new spec

Before creating a file, check whether the work extends a theme that already has a spec file (charts, archive, editor blocks, …). If it does, **append it as a new part** of that file. If not, create a standalone file. A standalone file can be consolidated with a later related spec.

1. Generate the id: `date -u +%Y%m%d%H%M`
2. Either:
   - **New file:** copy `docs/specs/_template.md` to `docs/specs/<id>-<feature>-<description>.md` and fill in the YAML frontmatter (`id`; `title`, `status: draft`, `feature`, `created`, `updated` — both set to today in `YYYY-MM-DD`), or
   - **New part:** append a part to the existing file as described in [Consolidated spec files](#consolidated-spec-files), using the template's sections demoted one level, and bump the file's `updated` date
3. Fill in at minimum: Problem Statement, Goals, Non-Goals, Acceptance Criteria
4. Run `bun --bun run specs:index`
5. Commit with the `docs(spec):` convention

Use the `/spec` Claude Code slash command to automate steps 1–4:

```
/spec "habit streak freeze"
```

## Relationship to feature docs

| Doc type    | Location                              | Purpose                                              | When updated                 |
| ----------- | ------------------------------------- | ---------------------------------------------------- | ---------------------------- |
| Feature doc | `docs/<feature>.md`                   | Current-state reference: store, components, behavior | When a spec is marked `done` |
| Spec        | `docs/specs/<id>-<feature>-<name>.md` | Forward-looking: problem, design, criteria           | While planning and building  |

After marking a spec `done`:

1. Update the relevant sections of `docs/<feature>.md` to reflect the new state
2. Do not delete the spec file — it serves as a historical record of design decisions

## Commit conventions

Use `docs(spec):` for all spec-related commits:

```
docs(spec): add habits-streak-freeze spec
docs(spec): update finance-recurring-transactions to in-progress
docs(spec): mark notes-tag-editing-ui as done
```

Updating a feature doc after a spec ships uses the normal feature scope:

```
docs(habits): update streak section after streak-freeze spec
```

## Updating a spec mid-flight

During `in-progress`, the spec should be treated as mostly locked. Acceptable updates:

- Resolving open questions (check off the item, note the decision inline)
- Adding acceptance criteria discovered during implementation
- Noting scope changes with a brief explanation

Do not retroactively rewrite the problem statement or goals once implementation has started — that obscures design history. Append an `## Amendments` section at the bottom instead.
