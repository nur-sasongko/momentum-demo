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

Update the `status` field in frontmatter and in `docs/specs/_index.md` at each transition. Update the `updated` frontmatter date whenever the file changes.

## Naming convention

```
docs/specs/<feature>-<description>.md
```

- `<feature>` must be one of: `habits`, `finance`, `notes`, `core`
- `<description>` is a short kebab-case summary of what is being specced
- Use `core-` for shared infrastructure: `AppShell`, `AppSidebar`, `src/stores/` patterns, `src/utils/`, PWA, routing, or anything that touches more than one feature area

Examples:

```
docs/specs/habits-streak-freeze.md
docs/specs/finance-recurring-transactions.md
docs/specs/notes-tag-editing-ui.md
docs/specs/core-global-search.md
```

**Cross-feature specs:** when a spec genuinely spans two features, use `core-` as the prefix and add `related-features` to the frontmatter:

```yaml
feature: core
related-features: [habits, finance]
```

## Creating a new spec

1. Copy `docs/specs/_template.md` to `docs/specs/<feature>-<description>.md`
2. Fill in the YAML frontmatter (`title`, `status: draft`, `feature`, `created`, `updated` — both set to today in `YYYY-MM-DD`)
3. Fill in at minimum: Problem Statement, Goals, Non-Goals, Acceptance Criteria
4. Add a row to the top of the table in `docs/specs/_index.md`
5. Commit with the `docs(spec):` convention

Use the `/spec` Claude Code slash command to automate steps 1–4:

```
/spec "habit streak freeze"
```

## Relationship to feature docs

| Doc type    | Location                         | Purpose                                              | When updated                 |
| ----------- | -------------------------------- | ---------------------------------------------------- | ---------------------------- |
| Feature doc | `docs/<feature>.md`              | Current-state reference: store, components, behavior | When a spec is marked `done` |
| Spec        | `docs/specs/<feature>-<name>.md` | Forward-looking: problem, design, criteria           | While planning and building  |

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
