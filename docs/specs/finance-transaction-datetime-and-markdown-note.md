---
id: 7
title: 'Transaction Date Time & Markdown Note'
status: in-progress
feature: finance
created: 2026-07-29
updated: 2026-07-31
---

# Transaction Date Time & Markdown Note

## Problem Statement

Transactions currently record only a calendar day (`finance_transactions.date`), so the user has no way to tell _when during the day_ a transaction happened — a $12 charge could be breakfast or dinner. Separately, the `note` field is a plain 200-character text box with no formatting, too limited to capture richer context (an itemized list, emphasis, a link) about what the transaction was for.

## Goals

- Let the user optionally record a time of day alongside the transaction date, defaulting to "no time set" (date-only) for backward compatibility with existing rows.
- Let the user write the transaction note as markdown, with a write/preview toggle in the Add/Edit form.
- Keep the `note` field/column name unchanged — this is a capability upgrade to the existing field, not a new field.
- Existing date-only comparisons (date-range filtering, sorting, aggregation) keep working correctly once the column carries time-of-day.

## Non-Goals

- Not renaming `note` → `description`, and not adding a second column — one field, upgraded in place.
- Not reusing Notes' full TipTap editor as-is. Notes stores ProseMirror JSON (`JSONContent`) in a client-only Zustand store and its editor is entangled with Notes-specific extensions (slash-commands, note-linking, tables, callouts) plus a large block of Notes-specific global CSS. Instead, a small standalone TipTap instance is used (see Amendments) — same underlying editor technology, but a minimal extension set (bold/italic/lists/link) and its own markdown round-trip, kept independent of the Notes store/CSS.
- ~~Not rendering a rich preview in the transactions table's inline `note` cell.~~ Reversed — see Amendments; the table's Note column now renders and edits markdown too, via the same promoted editor.
- Not changing the finance date-range _filter_'s granularity — `finance-filters.tsx`'s range picker stays day-level; only the per-transaction date gains time-of-day.

## Acceptance Criteria

- [x] Given the Add Transaction form, when the user picks a date and optionally a time, then the transaction saves with that date-time (or date-only, at local midnight, if no time was entered).
- [x] Given a transaction saved without an explicit time, when displayed anywhere (form, table), then it shows just the date (e.g. "Jul 29"), not a spurious "12:00 AM".
- [x] Given a transaction saved with an explicit time, when displayed, then it shows date and time (e.g. "Jul 29, 2:30 PM").
- [x] Given the Add/Edit Transaction form's Note field, when the user types and applies formatting (bold, italic, lists, link), then it renders live/formatted immediately, using the same `prose` typography styling as the rest of the app (no separate write/preview step).
- [x] Given a transaction with a note longer than 200 characters (up to 5000), when saved, then it is not rejected by validation.
- [x] Given the finance date-range filter has a `to` bound of today, when a transaction happened this afternoon, then it is still included in both the transactions table and the aggregate charts (no false exclusion from the timestamp now carrying time-of-day).
- [x] Given the transactions table's Date column, when the user inline-edits it, then the same `DateTimePicker` popover used by the Add/Edit form is shown and saving round-trips correctly to the stored ISO string.
- [ ] Given an existing pre-migration transaction (originally a bare `date` value), when the migration runs, then it reads back as midnight local-equivalent with no explicit time, and displays as a bare date exactly as before. _(requires `supabase db push`/reset against a running instance — not verifiable from static review; run manually before marking this spec `done`.)_
- [x] Given the transactions table's Note column, when displayed, then it renders the markdown (not raw syntax); when clicked, it opens the same rich editor used in the Add/Edit form and saves on close.

## Data Model Changes

**Store:** `src/stores/finance-store.ts`

```ts
export interface Transaction {
  id: string
  type: TransactionType
  amount: number
  date: string // ISO datetime string; time-of-day is optional (midnight = "no time set")
  note: string // now markdown-capable; validated up to 5000 chars (was 200, plain text)
  categoryId: string
  category?: FinanceCategory
  location: TransactionLocation | null
  createdAt: string
  updatedAt: string
}
```

No field added or renamed — `date` and `note` keep their existing shape (`string`), only their semantics/limits widen.

**Migration:** `supabase/migrations/20260729000001_alter_finance_transactions_date_timestamptz.sql` widens `finance_transactions.date` from `date` to `timestamptz` (mirrors the identical migration already done for `tasks.deadline`: `supabase/migrations/20260705000005_alter_tasks_deadline_timestamptz.sql`). No column added/renamed for `note` — it is already an unbounded `text` column; only the app-level zod max length changes.

## UI / UX Notes

- `transaction-form.tsx`'s Date field and the transactions table's Date column both use a new shared `DateTimePicker` component (`src/components/ui/datetime-picker.tsx`): a single `Popover` containing a `Calendar` and a `Time (optional)` field together, so picking a date and adjusting the time is one cohesive interaction instead of two disconnected controls. See Amendments below — this replaced an earlier split-field version.
- The Note field's plain `Textarea` is replaced with `src/components/markdown/markdown-editor.tsx` (`MarkdownEditor`), a live WYSIWYG editor: a small TipTap instance (`StarterKit` + `Link` + `Placeholder`, backed by `tiptap-markdown` for markdown round-trip) with a small persistent toolbar (Bold, Italic, Bullet list, Numbered list, Link), styled with the same `prose prose-sm dark:prose-invert` classes used elsewhere. See Amendments below — this replaced an earlier Write/Preview tabbed version, and was later promoted out of the finance feature.
- The transactions table's Note column now uses `src/components/markdown/markdown-editor-cell.tsx` (`MarkdownEditorCell`): a compact rendered markdown preview (via `react-markdown`/`remark-gfm`) as the closed-state trigger, opening a `Popover` with the same `MarkdownEditor` for editing, committing on close. See Amendments.

## Edge Cases

- **No explicit time set:** both newly created and pre-migration transactions with a midnight-local timestamp are treated as "date-only" for display purposes (`hasExplicitTime` returns `false`), matching the tasks-feature convention.
- **Date-range filter boundary:** the upper bound of a day-level filter range (`dateTo`) must be treated as end-of-day, not start-of-day, once transactions can carry time-of-day — otherwise same-day afternoon/evening transactions are wrongly excluded. Applies to both the server-side Supabase query (`finance-queries.ts`) and the client-side aggregate filter (`finance-utils.ts`).
- **Persistence boundary:** `date` and `note` are ordinary Supabase columns — no client-only state involved, they persist and reload exactly as before.

## Implementation Notes

1. `supabase/migrations/20260729000001_alter_finance_transactions_date_timestamptz.sql` — widen `date` to `timestamptz`. Written; not yet applied/verified against a Supabase instance — run and confirm before marking spec done.
2. `src/utils/date.ts` — add `hasExplicitTime`, `formatDateTimeLabel`, `endOfDayIso`. Done. (`toDatetimeInputValue`/`fromDatetimeInputValue` were added and later removed — see Amendments.)
3. `src/routes/_authenticated/tasks/-utils/tasks-utils.ts` — reuse the promoted `hasExplicitTime` from `#/utils/date` instead of its own copy. Done.
4. `src/components/ui/datetime-picker.tsx` (new) — shared `DateTimePicker` component: one `Popover` with a `Calendar` and a time field together. Done. See Amendments.
5. `src/routes/_authenticated/finance/-components/transaction-form.tsx` — raise `note` zod max to 5000; use `DateTimePicker` for the Date field; swap default-date helper; use `formatDateTimeLabel` for display. Done.
6. `src/components/markdown/markdown-editor.tsx` (new, promoted from a finance-scoped `note-markdown-editor.tsx`) — live TipTap WYSIWYG markdown editor with a formatting toolbar, wired into the form via `Controller`. Done. See Amendments.
7. `src/components/markdown/markdown-editor-cell.tsx` (new) — table-cell wrapper: compact rendered preview + popover-based `MarkdownEditor` for editing, commit-on-close. Done. See Amendments.
8. `src/routes/_authenticated/finance/-components/transactions-table.tsx` — Date column uses the shared `DateTimePicker` (not `EditableCell`); Note column uses `MarkdownEditorCell` (not `EditableCell`). Done.
9. `src/routes/_authenticated/finance/-utils/finance-queries.ts` — `useTransactionsQuery`'s `dateTo` bound uses `endOfDayIso`. Done.
10. `src/routes/_authenticated/finance/-utils/finance-utils.ts` — `isInDateRange`'s `to` bound uses `endOfDayIso`. Done.
11. `docs/finance.md` — update the `date`/`note` field descriptions. Done — updated ahead of spec completion since the field-level behavior was already fully built and tested (accepted deviation from the normal done-only doc-update convention).

## Test Plan

**Unit tests** (`src/utils/__test__/` or colocated per existing convention, and `src/routes/_authenticated/finance/-utils/__test__/finance-utils.test.ts`):

- [x] `hasExplicitTime` returns `false` for a midnight-local ISO string and `true` otherwise.
- [x] `formatDateTimeLabel` formats date-only vs date+time correctly.
- [x] `endOfDayIso` produces a timestamp at the end of the given local day.
- [x] `isInDateRange` includes a same-day afternoon transaction when `to` equals that day (regression test for the boundary fix).

**Component tests** (`src/components/ui/__test__/`, `src/components/markdown/__test__/`):

- [x] `markdown-editor` renders an initial markdown value as formatted rich text, shows its formatting toolbar, shows a placeholder when empty, associates its `id` with the field label, and re-syncs content when the `value` prop changes externally (e.g. switching between transactions).
- [x] `markdown-editor-cell` renders a compact rendered preview when closed (and a muted dash when empty), opens the full editor with the current value on click, and commits the new value via `onSave` only when it changed when "Done" is clicked.
- [x] `datetime-picker` opens one popover with a calendar and time field together, leaves the time field empty when no explicit time is set, merges a changed time into the existing date, shows a "Clear time" button only when a time is set and resets to date-only when clicked, and closes on "Done".

**Manual verification:**

- [ ] Open `/finance`, add a transaction with a specific time (e.g. 2:30 PM), verify it saves and displays with the time.
- [ ] Add a transaction with no time, verify it displays as a bare date.
- [ ] Type and format text (bold/list/link) in the Note field, verify it renders live with no separate preview step.
- [ ] Set the date-range filter's `to` to today, verify a same-day afternoon transaction is still shown.
- [ ] Inline-edit the transactions table's Date column via the shared `DateTimePicker` and verify it saves correctly.
- [ ] Confirm the transactions table's Note column shows rendered (not raw) markdown, clicking it opens the same rich editor used in the Add/Edit form, and saving updates the displayed preview.

## Amendments

- **2026-07-30 — Unified date/time picker.** The initial implementation used a split UI: the Add/Edit form had a `Calendar` popover plus a separate native `<input type="time">` below it, and the transactions table used a raw native `<input type="datetime-local">`. A UX review found this felt disjointed and inconsistent between the two surfaces. Replaced both with one shared `DateTimePicker` component (`src/components/ui/datetime-picker.tsx`) — a single popover containing the calendar and time field together — used identically in the form and the table. This also resolves the earlier open question about the table/form UI mismatch (no longer applicable, since both now use the same component). As part of this, `toDatetimeInputValue`/`fromDatetimeInputValue` (added for the native `datetime-local` round-trip) and `EditableCell`'s `'datetime-local'` type were removed as dead code.
- **2026-07-30 — Explicit clear-time control.** Follow-up feedback noted that clearing a set time relied on the browser's native (and not very discoverable, inconsistent across browsers) clear affordance on `<input type="time">`. Added a dedicated "Clear time" button to `DateTimePicker`, shown only when the current value has an explicit time, resetting to local midnight ("no time set") when clicked.
- **2026-07-30 — Live WYSIWYG note editor.** Follow-up feedback wanted the Note field to feel like Notes' live editing experience rather than a Write/Preview toggle. Rebuilt `note-markdown-editor.tsx` as a small standalone TipTap instance (`@tiptap/starter-kit` + `@tiptap/extension-link` + `@tiptap/extension-placeholder`, all already dependencies) with its own minimal toolbar, deliberately _not_ reusing Notes' entangled editor (see Non-Goals). To keep the `note` column and its `z.string().max(5000)` validation unchanged, added the `tiptap-markdown` package (new dependency, compatible with the installed TipTap v3) so the editor round-trips plain markdown text via `editor.storage.markdown.getMarkdown()` rather than storing ProseMirror JSON or HTML. `react-markdown`/`remark-gfm` (used only by the old Preview tab) were unused in `src/` again at this point — see the next amendment for where they came back into use.
- **2026-07-31 — Editor promoted; table Note column now renders markdown.** Follow-up feedback asked to (a) generalize the note editor beyond finance, and (b) make the transactions table's Note column render/edit markdown too, reversing the earlier Non-Goal. Moved `note-markdown-editor.tsx` → `src/components/markdown/markdown-editor.tsx`, renamed `NoteMarkdownEditor` → `MarkdownEditor` (mirrors the existing `src/components/location/` precedent — a domain-named folder for a composite component, not a bare `src/components/ui/` primitive), since it's no longer finance/note-specific. Added `src/components/markdown/markdown-editor-cell.tsx` (`MarkdownEditorCell`), following the same "click to open a `Popover` with a richer editor" idiom as `DateTimePicker`/`LocationCell`: a compact rendered preview (via `react-markdown`/`remark-gfm`, bringing those dependencies back into use) as the closed-state trigger, with the full `MarkdownEditor` inside the popover for editing, committing on close. The transactions table's Note column now uses `MarkdownEditorCell` instead of a plain `EditableCell`.

## Open Questions

None.
