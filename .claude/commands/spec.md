Create a new spec file for the Momentum project based on this feature description: $ARGUMENTS

Follow these steps exactly:

## Step 1: Derive the feature area

Analyze "$ARGUMENTS" to determine the feature area:

- `habits` — habit tracking, streaks, daily check-ins, habit creation/deletion, habit history
- `finance` — transactions, budgets, income/expense tracking, categories, balance
- `notes` — Second Brain / notes editor, Tiptap, tags, note list, read-only mode
- `core` — cross-cutting: navigation, app shell, global search, shared utilities, PWA, infrastructure, or anything spanning two features

If ambiguous, use `core` and note it in your report.

## Step 2: Slugify the description

Convert "$ARGUMENTS" to a filename slug:

- Lowercase all characters
- Replace spaces and special characters with hyphens
- Remove leading/trailing hyphens
- Do NOT include the feature prefix in the slug

Examples: "habit streak freeze" → `habit-streak-freeze`, "Recurring Transactions" → `recurring-transactions`

Final filename: `docs/specs/<feature>-<slug>.md`

## Step 3: Read the template

Read `docs/specs/_template.md` to use as the base content.

## Step 4: Create the spec file

Write `docs/specs/<feature>-<slug>.md` using the template content with these frontmatter values filled in:

- `title`: title-case version of "$ARGUMENTS"
- `status`: `draft`
- `feature`: the derived feature area
- `created`: today's date in YYYY-MM-DD format
- `updated`: today's date in YYYY-MM-DD format

If the feature area is unambiguous, pre-fill the `**Store:**` line in the Data Model section with the correct path (e.g. `src/stores/habits-store.ts`). Leave all other section bodies as template placeholder text.

If `docs/specs/<feature>-<slug>.md` already exists, stop and report the conflict instead of overwriting.

## Step 5: Update the spec index

Read `docs/specs/_index.md` and add a new row at the TOP of the table body (directly below the header row):

```
| [Title](./feature-slug.md) | feature | draft | YYYY-MM-DD |
```

## Step 6: Report back

After creating the file and updating the index, report:

1. The full path of the new spec: `docs/specs/<feature>-<slug>.md`
2. The feature area chosen and why (one sentence)
3. Next step: "Open the file and fill in Problem Statement, Goals, Non-Goals, and Acceptance Criteria to complete the draft."
4. The commit message to use when ready: `docs(spec): add <feature>-<slug> spec`

Do not commit the files.
