---
id: 9
title: 'Transaction Form UX Polish'
status: in-progress
feature: finance
created: 2026-07-30
updated: 2026-07-30
---

# Transaction Form UX Polish

## Problem Statement

Two small inconsistencies make editing transactions feel rougher than it should. First, the transactions table's inline Amount editor is a raw number input that behaves differently from the Amount field in the Add/Edit sheet (no thousands separators, no shared parsing logic), so the same value can look and behave differently depending on where it's edited. Second, closing the Add/Edit transaction sheet — via the close button, an overlay click, Escape, or the Cancel button — silently discards any unsaved changes with no confirmation, risking accidental data loss.

## Goals

- Make the transactions table's inline Amount editor use the same formatting/parsing behavior as the Add/Edit sheet's Amount field.
- Prompt the user to confirm before discarding unsaved changes when closing the Add/Edit transaction sheet.

## Non-Goals

- Not turning `EditableCell` into a general pluggable-input system — only adding the minimal override needed for the Amount column.
- Not adding unsaved-changes guards to other sheets/dialogs in the app (e.g. the category manager) in this pass.

## Acceptance Criteria

- [x] Given the transactions table's Amount cell, when the user enters edit mode, then the input formats the value with the same locale-aware thousands separators as the Add/Edit sheet's Amount field.
- [x] Given the transactions table's Amount cell, when the user commits a positive amount, then it saves the parsed numeric value; an empty, zero, or invalid amount is not saved.
- [x] Given the Add/Edit transaction sheet with unsaved changes, when the user attempts to close it (close button, overlay click, Escape, or Cancel), then a confirmation dialog appears offering "Keep editing" or "Discard changes".
- [x] Given the confirmation dialog, when the user chooses "Keep editing", then the sheet stays open with the edits intact.
- [x] Given the confirmation dialog, when the user chooses "Discard changes", then the sheet closes and resets, exactly as closing did before this change.
- [x] Given the Add/Edit transaction sheet with no unsaved changes (fresh "add" or freshly opened "edit"), when the user closes it, then it closes immediately with no confirmation dialog.

## Data Model Changes

None — this is UI-only; no store or schema changes.

## UI / UX Notes

- `src/components/ui/editable-cell.tsx` gains an optional `renderInput` prop that, when provided, replaces the built-in text input entirely for that cell (keeping the same overlay styling). The transactions table's Amount column uses it to render `CurrencyInput` (`#/components/ui/currency-input`) instead of a plain `<input type="number">`.
- A new `AlertDialog` (scaffolded via shadcn, `src/components/ui/alert-dialog.tsx`) is used for the discard/stay confirmation, matching this repo's existing Shadcn conventions (new-york style, `radix-ui` unified import).
- `transaction-form.tsx` gates every close path (Sheet `onOpenChange`, footer Cancel button) behind `form.formState.isDirty`: dirty → show the confirmation dialog; not dirty → close immediately, same as before.

## Edge Cases

- **Not dirty:** closing a form with no edits never shows the dialog, in both add and edit modes.
- **Persistence boundary:** none — this is transient UI state (`confirmCloseOpen`), not persisted.

## Implementation Notes

1. `src/components/ui/editable-cell.tsx` — add `renderInput` override prop; extract shared overlay input className. Done.
2. `src/routes/_authenticated/finance/-components/transactions-table.tsx` — Amount column uses `renderInput` with `CurrencyInput`; `onSave` uses `parseFormattedNumber` instead of `parseFloat`. Done.
3. `src/components/ui/alert-dialog.tsx` (new, shadcn-scaffolded) — standard AlertDialog primitives. Done.
4. `src/routes/_authenticated/finance/-components/transaction-form.tsx` — add `confirmCloseOpen` state, `requestClose` guard, wire into Sheet `onOpenChange` and the Cancel button, render the `AlertDialog`. Done.

## Test Plan

**Component tests** (`src/routes/_authenticated/finance/-components/__test__/`):

- [x] `transactions-table`: Amount cell renders a formatted `CurrencyInput` in edit mode; committing a valid amount saves the parsed number; `0`/invalid does not save; Escape cancels.
- [x] `transaction-form`: closing an unedited form (add and edit modes) closes immediately with no dialog; closing an edited form shows the confirmation dialog; "Keep editing" keeps the sheet open; "Discard changes" closes and resets; the Cancel button follows the same guard.

**Manual verification:**

- [ ] Inline-edit the Amount cell in the transactions table and confirm formatting/parsing matches the sheet's Amount field.
- [ ] Open Add/Edit transaction, edit a field, and confirm the dialog appears when closing via the X button, overlay click, Escape, and Cancel — "Stay" keeps edits, "Discard" clears them.

## Open Questions

None.
