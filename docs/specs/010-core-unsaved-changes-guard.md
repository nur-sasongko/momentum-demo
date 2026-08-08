---
id: 10
title: 'Global Unsaved-Changes Guard'
status: in-progress
feature: core
related-features: [finance, tasks, habits]
created: 2026-07-31
updated: 2026-07-31
---

# Global Unsaved-Changes Guard

## Problem Statement

The finance transaction Add/Edit sheet already confirms before discarding unsaved edits on close, but every other add/edit sheet or dialog in the app (tasks, habits, the finance Category Manager) closes silently on Escape, overlay click, the built-in close button, or a Cancel button — a user can lose in-progress work with a single accidental click.

## Goals

- Apply the same "confirm before discarding unsaved changes" behavior to every add/edit sheet/dialog in the app that represents genuine multi-field, in-progress work.
- Extract the pattern (already built once for the finance transaction form) into a shared hook + dialog component so it isn't reimplemented per feature.

## Non-Goals

- Not guarding the finance Category Manager's per-row inline edit forms (`CategoryRow`) — each row already has its own scoped Save/Cancel buttons, so there's no sheet-level close action that could discard a row edit silently. Only the sheet-level "Add category" form is guarded.
- Not guarding small, single-value picker dialogs: the task Deadline picker (`deadline-picker-dialog.tsx`), the transaction Location picker (`location-picker.tsx`), or the Notes tag-rename dialog (`tag-manager-dialog.tsx`). Closing these just loses one quick pick, not a multi-field draft, and they're nested inside forms that are already guarded (or, for tag-rename, hold negligible state).
- Not changing Notes' full-page note editor — it autosaves on every keystroke, so there's no unsaved draft to lose.

## Acceptance Criteria

- [x] Given any of the guarded forms (finance transaction sheet, finance Category Manager's Add form, tasks Add Task sheet, tasks New/Edit List sheet, habits New Habit dialog) with unsaved changes, when the user attempts to close it (close button, overlay click, Escape, or Cancel), then a confirmation dialog appears offering "Keep editing" or "Discard changes".
- [x] Given the same forms with no unsaved changes, when closed, then they close immediately with no confirmation dialog.
- [x] Given the confirmation dialog, "Keep editing" leaves the form open with the draft intact; "Discard changes" closes and discards, exactly as closing did before this change.
- [x] Given the tasks New/Edit List sheet in edit mode, when the fields match the list being edited (no real change), then closing doesn't prompt — the dirty check compares against the list's actual values, not just "non-empty".
- [x] Given the finance Category Manager, editing an existing category row (its own inline form) does not trigger the sheet-level confirmation — only the "Add category" form's dirty state gates the sheet's close.

## Data Model Changes

None — this is transient UI state (`confirmOpen`) in each consumer, not persisted.

## UI / UX Notes

- **`src/hooks/use-unsaved-changes-guard.ts`** — `useUnsavedChangesGuard(isDirty, onClose)` returns `{ confirmOpen, setConfirmOpen, requestClose }`. `requestClose` opens the confirm dialog when `isDirty`, otherwise calls `onClose` immediately.
- **`src/components/discard-changes-dialog.tsx`** — `DiscardChangesDialog` wraps the existing `AlertDialog` (`#/components/ui/alert-dialog`) with default copy ("Discard unsaved changes?" / "Keep editing" / "Discard changes"), overridable via `title`/`description` props so each consumer can name what's being discarded (a transaction, a task, a list, a habit, a category).
- Each consumer wraps its Sheet/Dialog's `onOpenChange` to call `requestClose()` instead of closing directly, and its Cancel button's `onClick` to `requestClose`.

## Edge Cases

- **react-hook-form consumers** (finance transaction form, habits New Habit dialog, finance Category Manager's Add form): `isDirty` comes straight from `form.formState.isDirty`.
- **Plain `useState` consumers** (tasks Add Task sheet, tasks New/Edit List sheet): `isDirty` is computed manually — non-empty fields for "create" flows, a diff against the original record for "edit" flows (tasks New/Edit List sheet).
- **Nested independent forms** (finance Category Manager): the outer Sheet was previously uncontrolled (no `open`/`onOpenChange`) and had to become a controlled component; the "Add category" form reports its dirty state up via an `onDirtyChange` callback rather than lifting the whole form instance.
- **habits New Habit dialog**: discarding now also resets the form back to defaults — previously the Cancel button didn't reset the form at all, a pre-existing gap that "discard" must actually fix.

## Implementation Notes

1. `src/hooks/use-unsaved-changes-guard.ts` (new) — shared hook, extracted from the finance transaction form's existing inline logic. Done.
2. `src/components/discard-changes-dialog.tsx` (new) — shared dialog. Done.
3. `src/routes/_authenticated/finance/-components/transaction-form.tsx` — refactored onto the shared hook/dialog, no behavior change. Done.
4. `src/routes/_authenticated/tasks/-components/add-task-sheet.tsx` — manual `isDirty`, wired. Done.
5. `src/routes/_authenticated/tasks/-components/new-list-sheet.tsx` — manual `isDirty` diffed against create/edit baseline, wired. Done.
6. `src/routes/_authenticated/habits/-components/new-habit-modal.tsx` — `form.formState.isDirty`, wired; discard now also resets the form. Done.
7. `src/routes/_authenticated/finance/-components/category-manager.tsx` — outer Sheet converted to controlled; `AddCategoryForm` gained an `onDirtyChange` prop; only the Add form gates the sheet-level guard. Done.

## Test Plan

**Unit tests:**

- [x] `src/hooks/__tests__/use-unsaved-changes-guard.test.ts` — not dirty closes immediately; dirty opens the confirm dialog instead; `setConfirmOpen` can close the dialog without discarding.

**Component tests:**

- [x] `src/components/__test__/discard-changes-dialog.test.tsx` — default and custom title/description; "Keep editing" vs. "Discard changes" wiring; renders nothing interactive when closed.
- [x] `src/routes/_authenticated/finance/-components/__test__/transaction-form.test.tsx` — existing tests, unchanged, still pass after the refactor.
- [x] `src/routes/_authenticated/tasks/-components/__test__/add-task-sheet.test.tsx` — untouched closes immediately; dirty shows the dialog; "Keep editing"/"Discard changes" behave correctly.
- [x] `src/routes/_authenticated/tasks/-components/__test__/new-list-sheet.test.tsx` — same shape for both create and edit-mode dirty baselines.
- [x] `src/routes/_authenticated/habits/-components/__test__/new-habit-modal.test.tsx` — same shape; also verifies the form resets after discard.
- [x] `src/routes/_authenticated/finance/-components/__test__/category-manager.test.tsx` — typing in the Add form then closing shows the dialog; editing an existing row does not.

**Manual verification:**

- [ ] Open each of the five guarded forms, edit a field, and confirm the dialog appears when closing via the X button, overlay click, Escape, and Cancel — "Keep editing" keeps the draft, "Discard changes" clears it.
- [ ] Confirm editing an existing category row in Category Manager does not trigger the sheet-level dialog.

## Open Questions

None.
