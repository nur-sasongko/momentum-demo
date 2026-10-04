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

## Step 3: Determine the next id

Run `date -u +%Y%m%d%H%M` and use its output as the id: a 12-digit UTC timestamp, e.g. `202610041316`. Do not derive it from `_index.md`; ids are timestamps so parallel branches never collide.

Final filename: `docs/specs/<id>-<feature>-<slug>.md`

## Step 4: Read the template

Read `docs/specs/_template.md` to use as the base content.

## Step 5: Create the spec file (or append a part)

First, list `docs/specs/` and check whether "$ARGUMENTS" extends a theme that already has a spec file (e.g. a new finance chart → `202607300500-finance-charts.md`; an editor block feature → `202609100500-notes-editor-blocks.md`). If one clearly fits, **append a new part to that file** instead of creating a new one, following the "Consolidated spec files" section of `docs/architecture/spec-workflow.md`: an `<a id="spec-<id>"></a>` anchor, a `## <id> — Title` heading, a `**Status:** draft · **Created:** … · **Updated:** …` line, then the template sections demoted one level (`###`). Bump the file's `updated` date (Step 6 regenerates its `consolidates`, `status` and part table). Report which file you chose and why. If no file clearly fits, create a new file:

Write `docs/specs/<id>-<feature>-<slug>.md` using the template content with these frontmatter values filled in:

- `id`: the timestamp from Step 3 (e.g. `202610041316`)
- `title`: title-case version of "$ARGUMENTS"
- `status`: `draft`
- `feature`: the derived feature area
- `created`: today's date in YYYY-MM-DD format
- `updated`: today's date in YYYY-MM-DD format

If the feature area is unambiguous, pre-fill the `**Store:**` line in the Data Model section with the correct path (e.g. `src/stores/habits-store.ts`). Leave all other section bodies as template placeholder text.

If `docs/specs/<id>-<feature>-<slug>.md` already exists, stop and report the conflict instead of overwriting.

## Step 6: Update the spec index

`docs/specs/_index.md` is generated, so never edit it by hand. Run `bun --bun run specs:index`, which rebuilds it (and any part tables) from the specs' frontmatter. If the script reports a validation error, fix the spec and re-run it.

## Step 7: Report back

After creating the file and updating the index, report:

1. The full path of the new spec (or the existing file plus `#spec-<id>` anchor if appended as a part)
2. The feature area chosen and why (one sentence)
3. Next step: "Open the file and fill in Problem Statement, Goals, Non-Goals, and Acceptance Criteria to complete the draft."
4. The commit message to use when ready: `docs(spec): add <feature>-<slug> spec`

Do not commit the files.
