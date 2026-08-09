---
id: 17
title: 'Notes Editor: Explicit Save & No Phantom Writes'
status: in-progress
feature: notes
created: 2026-08-10
updated: 2026-08-10
---

# Notes Editor: Explicit Save & No Phantom Writes

## Problem Statement

Merely opening a note writes to the database. The user opens a note they have not touched, and within a second a `PATCH /rest/v1/notes` fires (followed by the list `GET` that its cache patch provokes), the note's `updated_at` moves to now, the note jumps to the top of the default `updated_at.desc` list, and the Undo button lights up as if there were an edit to undo. Nothing was edited. On top of that, the editor autosaves every 800 ms while typing, which the user does not want: saves land mid-sentence, the "Last edited" line churns, and every keystroke burst is a network write. There is also no protection against reloading or closing the tab with genuinely unsaved work — the browser just discards it.

### Root cause (measured, not inferred)

Probed by constructing a real editor with the app's actual extension set (`createEditorExtensions`) and counting `onUpdate` calls at construction:

| Stored doc's last node | `onUpdate` at init | `canUndo` at init |
| ---------------------- | ------------------ | ----------------- |
| paragraph              | 0                  | `false`           |
| bullet list            | **1**              | **`true`**        |
| table                  | **1**              | **`true`**        |
| code block             | **1**              | **`true`**        |

Four separate defects compound:

1. **A document mutation at construction time.** `Placeholder`'s ProseMirror plugin dispatches a viewport-measurement transaction (`view.dispatch(tr.setMeta('tiptap__viewportUpdate', true))`) as the editor mounts. That dispatch wakes `TrailingNode` — bundled into `StarterKit` and enabled by default — which sees the doc's last node is not a paragraph and inserts one. It is a real doc change, so Tiptap fires `onUpdate` → `tiptap-editor.tsx:64` calls `onChange(getJSON())` → `note-editor.tsx:321` calls `setDraft` → the 800 ms debounce elapses → `flush()` sees `draft !== lastSavedRef` and PATCHes. Verified: with `StarterKit.configure({ trailingNode: false })` the same docs give `onUpdate = 0` and `canUndo = false`.
2. **The dirty check compares raw stored JSON against Tiptap's normalized JSON.** Even with no transaction at all, `editor.getJSON()` differs from the stored blob because ProseMirror fills in default node attributes at parse time — a stored `tableHeader` with no `attrs` comes back as `attrs: {colspan: 1, rowspan: 1, colwidth: null, align: null}`. So `lastSavedRef`, seeded from `note.content`, can never match the editor's output, and the first flush of any kind writes a note the user never edited.
3. **The mount-time content sync adds a phantom history entry.** `tiptap-editor.tsx:112-123` compares `JSON.stringify(editor.getJSON())` against the `content` prop and calls `editor.commands.setContent(content, { emitUpdate: false })` when they differ — which is exactly the notes in defect 2. Verified: that call flips `editor.can().undo()` from `false` to `true`. `emitUpdate: false` suppresses the change event but not the history step, so this is a second, independent reason the Undo button is live on open.
4. **It repeats on every open instead of self-healing after one save.** `useUpdateNoteContentMutation`'s `onSuccess` patches only `title`, `excerpt`, and `updatedAt` into the detail cache. `content` stays at the stale, un-normalized value for the query's 5-minute `staleTime`, so the next remount re-normalizes and re-PATCHes. (Verified separately: re-opening the _saved_ JSON gives `onUpdate = 0`, `canUndo = false` — the data does stabilize once the cache holds what was written.)

## Goals

- Opening a note must issue **zero** writes and leave Undo/Redo disabled until the user actually edits something.
- Remove the debounced autosave entirely.
- Save on leaving the editor: focus moves outside the editor pane, `Ctrl`/`Cmd`+`S`, switching to another note, or navigating away from `/notes`.
- Give the user an explicit, always-visible way to save: a floating bar pinned to the bottom-center of the editor pane that appears the moment the draft is dirty, reading "Unsaved changes" with a **Save** button.
- Warn via the browser's native dialog when reloading or closing the tab with unsaved changes.
- Make "dirty" an honest, normalization-insensitive comparison, surfaced in the UI so the user can tell whether their work is saved.

## Non-Goals

- Not adding a Save button to the editor header or toolbar. The only affordance is the floating bar, which exists only while dirty — no permanently-parked button competing with the icon row.
- Not making the floating bar a real modal `Dialog`. It must never trap focus, dim the page, or block typing; it is a non-modal status bar that happens to contain a button.
- Not adding a Discard button to the bar. Undo (`Ctrl`/`Cmd`+`Z`) is the way back; a discard control would need its own confirmation and has no clear target state (revert to last save? to open?).
- Not prompting a discard/keep dialog on in-app navigation. Navigating away saves silently — `useUnsavedChangesGuard` and `DiscardChangesDialog` from spec 10 are for forms that can be abandoned; a note is never abandoned, it is saved.
- Not touching note metadata mutations (favorite, read-only lock, tags). Those are already discrete, explicit, single-click actions via `useUpdateNoteMetaMutation` and stay immediate.
- Not adding conflict detection or multi-tab merge. Last write wins, as today.
- Not adding version history or an undo-past-save feature. The editor's undo stack remains in-memory and per-mount.
- Not changing the notes list, filters, or URL state — see spec 16.

## Acceptance Criteria

- [ ] Given a note whose content ends with a list, table, or code block, when the user opens it and waits, then **no** `PATCH` to `/rest/v1/notes` is issued and `updated_at` is unchanged.
- [ ] Given any note freshly opened, when the user has typed nothing, then the Undo and Redo buttons are both disabled.
- [ ] Given a note open with no edits, when the user clicks outside the editor pane, then no save is issued.
- [ ] Given the user types in the body or the title, when the debounce interval that used to exist elapses (~1s) and focus stays in the editor, then **no** save is issued — there is no autosave.
- [ ] Given unsaved edits, when focus leaves the editor pane (clicking the note list, the sidebar, or any element outside the pane), then exactly one save is issued.
- [ ] Given unsaved edits, when the user moves focus between the title input and the body, then no save is issued — the two are one editing unit.
- [ ] Given unsaved edits, when the user presses `Ctrl`+`S` (or `Cmd`+`S` on macOS), then the note saves, the browser's "Save page" dialog does not appear, and focus stays in the editor.
- [ ] Given unsaved edits, when the user opens a different note, then the edits are saved before the editor switches.
- [ ] Given unsaved edits, when the user navigates to another route (e.g. `/finance`) or presses Back, then the edits are saved and the navigation proceeds without a dialog.
- [ ] Given unsaved edits, when the user reloads or closes the tab, then the browser's native "Changes you made may not be saved" confirmation appears.
- [ ] Given no unsaved edits, when the user reloads, then no confirmation appears.
- [ ] Given the editor's header, when there are unsaved edits, then it reads "Unsaved changes"; during the request "Saving…"; briefly after success "Saved"; otherwise just the "Last edited …" text.
- [ ] Given a note with no unsaved edits, when the editor renders, then no floating save bar is present in the DOM.
- [ ] Given the user makes any edit to the title or body, then a floating bar appears at the bottom-center of the editor pane reading "Unsaved changes" with a **Save** button.
- [ ] Given the floating bar is visible, when the user clicks **Save**, then exactly one save is issued, the bar shows "Saving…" with the button disabled, and the bar disappears once the save succeeds.
- [ ] Given the user clicks **Save**, then focus returns to the editor body with the caret where it was — clicking the bar does not count as leaving the pane and does not trigger a second, blur-driven save.
- [ ] Given a save started from any trigger is in flight, then the bar reads "Saving…" and its button is disabled, so a second click cannot double-submit.
- [ ] Given a save fails, when the error toast appears, then the draft is preserved, the header and floating bar return to "Unsaved changes" with **Save** re-enabled, and the reload confirmation still fires.
- [ ] Given the bar is visible, when the user continues typing, then the bar stays put without shifting the editor's scroll position or covering the caret line at the bottom of the viewport.
- [ ] Given a read-only note, when the user tries to edit, then nothing is dirty, the floating bar never appears, and no save is ever issued.
- [ ] Given a note is saved, when the user switches away and back within the query's `staleTime`, then the editor receives the content that was written (not a stale copy) and issues no further save.
- [ ] Given a note ending in a table or code block, when the user wants a paragraph after it, then the ProseMirror gap cursor lets them place the caret below it and type — the affordance previously provided by the auto-inserted trailing paragraph.

## Data Model Changes

None. No store field and no Supabase column changes — `notes-store.ts` holds only `linkTargets` after spec 16, and this spec's state (`draft`, the saved snapshot, `saveState`) is component-local.

The `notes.content` column keeps holding Tiptap JSON. One behavioral note: because defect 1's phantom write is removed, existing notes stop being silently rewritten into normalized form on open. They are normalized on the first genuine save instead, which is the correct time.

## UI / UX Notes

Two surfaces carry save state: the quiet header text, and a new floating save bar.

**Header text** — the save-state text already present next to "Last edited …" gains an "Unsaved changes" state:

```
Last edited 3 minutes ago · Unsaved changes
Last edited 3 minutes ago · Saving…
Last edited just now · Saved
```

**Floating save bar** — a small, non-modal bar pinned to the bottom-center of the editor pane, present in the DOM only while the draft is dirty or a save is in flight:

```
                ┌──────────────────────────────────┐
                │ ● Unsaved changes    ⌘S  [ Save ]│
                └──────────────────────────────────┘
```

- **States:** `dirty` → amber dot + "Unsaved changes" + enabled **Save**; `saving` → spinner + "Saving…" + disabled button; on success the bar unmounts (the header's transient "Saved" carries the confirmation, so the bar does not linger); on error it returns to the `dirty` state with the button re-enabled.
- **Placement:** rendered as the last child _inside_ the editor pane wrapper, `absolute bottom-4 left-1/2 -translate-x-1/2 z-20` against a `relative` pane. Inside the pane deliberately — see the focus note below — and `absolute`-within-pane rather than `fixed`-to-viewport so it centres on the editor column, not the whole window including the note list.
- **Motion:** fade + 4px rise on enter (`animate-in fade-in slide-in-from-bottom-2`), no exit animation — a save that just landed should not leave a ghost bar mid-fade.
- **Not a `Dialog`.** Built from a plain `div` + the existing `Button`; it must not trap focus, dim the page, or interrupt typing. Semantics: `role="status"` with `aria-live="polite"` on the text so screen readers announce the transition to unsaved/saving, and the button is a normal tab stop after the editor body.
- **Mobile:** the pane is full-width on small screens, so the bar centres over it as-is; it sits above the safe-area inset (`pb-[env(safe-area-inset-bottom)]` on the pane) and its width is capped with `max-w-[calc(100%-2rem)]`.
- **Keyboard hint:** the bar shows `⌘S` on macOS and `Ctrl+S` elsewhere as muted text between the label and the button, so the bar teaches the shortcut rather than replacing it. Detect via `navigator.platform`/`userAgentData` once at module scope; if detection is unavailable, render `Ctrl+S`.

**Why the bar lives inside the pane:** clicking **Save** blurs the editor into the button. Because the button is inside the pane's DOM subtree, the pane's `onBlur` containment check sees `relatedTarget` inside and does not fire a leave-save — so the click produces exactly one save, from the button's own handler. The handler then calls `editorRef.current?.commands.focus()` to put the caret back.

**Save triggers**, in full:

| Trigger                       | Mechanism                                                                                                 |
| ----------------------------- | --------------------------------------------------------------------------------------------------------- |
| **Save** button on the bar    | `onClick` → `flush(draftRef.current)`, then refocus the editor                                            |
| Focus leaves the editor pane  | `onBlur` on the pane wrapper, ignored when `relatedTarget` is inside it                                   |
| `Ctrl`/`Cmd`+`S`              | `keydown` handler on the pane, `preventDefault()`                                                         |
| Switching notes               | `NoteEditor` is keyed by note id in `index.tsx:98`, so it unmounts — the existing unmount flush covers it |
| Navigating away from `/notes` | Same unmount flush                                                                                        |
| Tab/window closing            | `pagehide` flush, best-effort only (see Edge Cases)                                                       |

**Removed:** the `useDebouncedValue(draft, 800)` autosave effect (`note-editor.tsx:130-136`) and the `visibilitychange` listener (`note-editor.tsx:142-146`) — switching browser tabs is not "leaving the editor" and should not write.

**Dirty state** becomes render-visible rather than ref-only: the last-saved snapshot moves from `lastSavedRef` into `useState`, and `isDirty = !draftsEqual(draft, savedSnapshot)` is computed during render, because the header text, the floating bar's visibility, and the reload guard all need to react to it.

**New hook:** `src/hooks/use-beforeunload-guard.ts` — `useBeforeUnloadGuard(enabled: boolean)` registers a `beforeunload` listener only while `enabled`, calling `event.preventDefault()` (and setting `event.returnValue = ''` for older browsers). The dialog's wording is the browser's and cannot be customized; "Changes you made may not be saved" is Chrome's phrasing. Kept generic in `src/hooks/` because the finance and tasks forms are plausible future consumers.

## Edge Cases

- **Empty state:** a brand-new note from `buildEmptyNote()` has content `{doc: [paragraph]}`, which is already Tiptap-normalized — it opens clean and stays clean until typed into. (`EMPTY_DOC` in `notes-queries.ts:22` is a shared module-level object handed to every new note; return a fresh clone so no caller can mutate the shared default.)
- **Persistence boundary:** a draft lives only in component state. It is not written to `localStorage`, so a confirmed reload loses it — which is precisely why the `beforeunload` guard is required rather than optional.
- **`pagehide` cannot be trusted to save.** A normal `fetch`/XHR started during page teardown is routinely cancelled, and the Supabase client does not use `sendBeacon`. The flush stays as a best-effort attempt, but the `beforeunload` prompt is the actual guarantee. Do not present pagehide-saving as reliable in the UI.
- **`beforeunload` needs prior user interaction.** Chrome ignores the handler unless the page has sticky activation. Since being dirty requires typing, this is always satisfied in practice.
- **Blur with `relatedTarget === null`** (clicking a non-focusable region, or the window itself losing focus) must not be read as "left the pane". Check `event.currentTarget.contains(event.relatedTarget)` and, when `relatedTarget` is `null`, fall back to checking `document.activeElement` on the next tick before saving.
- **Blur into a portal.** The tag input's popover, the slash-command menu, the bubble menus, and the delete dialog render in portals _outside_ the pane's DOM subtree, so a naive containment check treats opening them as leaving the editor. Each portal-owning surface must be excluded — anchor the check on a `data-note-editor-pane` attribute plus an explicit allowlist for the editor's own portalled UI, and cover this with a test.
- **Save on unmount.** `flush()` during unmount calls `updateContent.mutate`; the per-call `onSuccess` that drives `setSaveState` may be skipped for an unmounted component, but the cache-patching `onSuccess` declared inside `useUpdateNoteContentMutation` still runs, so the list and detail caches stay correct.
- **Two saves racing.** Blur-then-`Cmd`+`S`, click-**Save**-then-blur, or blur immediately followed by unmount can fire twice. Since the snapshot now only advances in `onSuccess` (see below), `flush()` can no longer rely on the snapshot alone to dedupe — it must also early-return while a save is in flight, comparing the in-flight draft against the current one and re-flushing afterwards only if they differ. An `inFlightRef` holding the draft being written covers both.
- **The bar covering the caret.** The bar overlays the bottom of the scrollable editor area, so text typed on the last visible line can end up behind it. Give the editor's scroll container bottom padding equal to the bar's height plus its offset (`pb-20`) whenever the bar is shown — permanent padding is simpler but leaves dead space in the common clean state; a conditional class is fine because the bar's appearance already coincides with a re-render.
- **The bar and the delete dialog.** When the delete confirmation `Dialog` is open it renders above everything with an overlay; the bar's `z-20` sits below the Radix portal layer, so no clash. Deleting a note with unsaved edits discards them by design — the unmount flush must not resurrect a deleted note, so `flush()` refuses to run once a delete has been dispatched (`deletedRef`).
- **Failed save.** `flush()` currently advances `lastSavedRef` before awaiting the result, so a rejected request leaves the app believing it saved. The snapshot must only advance in `onSuccess`; on error it rolls back so the note stays dirty, the reload guard stays armed, and the next trigger retries. The existing error toast copy ("It will retry as you keep typing") is now wrong and must change.
- **Read-only notes:** `TiptapEditor.onUpdate` already returns early when `isReadOnly`, and the title input is `readOnly`. The save path additionally refuses to run for a read-only note, so no trigger can write one.
- **Dropping the mount-time `setContent`.** With the draft seeded from the editor's own post-init JSON, the sync effect at `tiptap-editor.tsx:112-123` has nothing left to reconcile — the editor is the source of truth for content within a mount, and a note switch remounts it via the `key`. Delete the effect rather than guard it, and confirm no path (wiki-link navigation, optimistic list seeding) depends on pushing content into a live editor.

## Implementation Notes

1. `src/routes/_authenticated/notes/-utils/tiptap-extensions.ts` — `StarterKit.configure({ codeBlock: false, link: false, trailingNode: false })`. This alone removes the init transaction, the phantom `onUpdate`, and the phantom history entry. `Gapcursor` (also in StarterKit) remains as the escape affordance after a trailing table or code block.
2. `src/routes/_authenticated/notes/-components/tiptap-editor.tsx` — add an `onReady?: (content: JSONContent) => void` fired once from the editor's `onCreate` with `editor.getJSON()`, so the parent can baseline against normalized output; delete the `content`-sync effect (lines 112-123).
3. `src/routes/_authenticated/notes/-components/note-editor.tsx` — the bulk of the change:
   - Seed both `draft.content` and the saved snapshot from `onReady`, so parse-time attribute defaults are never "dirty".
   - Move the snapshot from a ref into state; derive `isDirty` during render.
   - Delete the `useDebouncedValue` import, `debouncedDraft`, and the autosave effect.
   - Rework `flush()` to advance the snapshot in `onSuccess`, not before the request.
   - Add the pane wrapper's `onBlur` (with the containment/portal guard) and `onKeyDown` for `Ctrl`/`Cmd`+`S`.
   - Keep the unmount + `pagehide` flush; drop the `visibilitychange` listener.
   - Call `useBeforeUnloadGuard(isDirty)`.
   - Add `'dirty'` to the `saveState` union and render "Unsaved changes".
   - Make the pane wrapper `relative` and render `<UnsavedChangesBar>` as its last child when `!note.isReadOnly && (isDirty || saveState === 'saving')`; add the conditional `pb-20` on the scroll container while it is shown.
   - The `useEffect` keyed on `[note.id]` that re-seeds the draft is dead code — `NoteEditor` is keyed by note id in `index.tsx`, so it never re-runs with a different id. Remove it.
4. `src/routes/_authenticated/notes/-components/unsaved-changes-bar.tsx` (new) — presentational only: `{ state: 'dirty' | 'saving'; onSave: () => void }`. No mutation access, no store access; `NoteEditor` owns all save logic so the bar stays trivially testable. Exports the platform-aware shortcut label used in its hint.
5. `src/hooks/use-beforeunload-guard.ts` (new) — the guard hook.
6. `src/routes/_authenticated/notes/-utils/notes-queries.ts` — include the saved `content` in the detail-cache patch in `useUpdateNoteContentMutation.onSuccess` (available as the second `onSuccess` argument), fixing defect 4; fix the now-inaccurate error toast copy; make `buildEmptyNote()` return a fresh content object instead of the shared `EMPTY_DOC`.
7. `docs/second-brain.md` — replace the autosave description with the explicit-save model, the trigger table, and the floating save bar.
8. `docs/specs/010-core-unsaved-changes-guard.md` — its Non-Goals say the note editor "autosaves on every keystroke, so there's no unsaved draft to lose". That is no longer true; append a note pointing at this spec.
9. `CHANGELOG.md` — `### Fixed` for the phantom write on open, `### Changed` for autosave → explicit save, `### Added` for the unsaved-changes bar.

## Test Plan

**Unit tests:**

- [x] `src/hooks/__tests__/use-beforeunload-guard.test.ts` — the listener is attached only while enabled, removed on disable and on unmount, and calls `preventDefault` on the event.
- [x] `src/routes/_authenticated/notes/-utils/__test__/tiptap-extensions.test.ts` (new) — the regression test for defect 1, and the reason this spec is trustworthy: construct an `Editor` with `createEditorExtensions` over docs ending in a paragraph, bullet list, table, and code block; assert `onUpdate` fires **0** times and `editor.can().undo()` is `false` for every shape. This test fails on today's code for three of the four shapes.
- [x] `notes-queries.test.ts` — `useUpdateNoteContentMutation`'s success handler writes `content` into the detail cache; `buildEmptyNote()` returns a distinct content object on each call.

**Component tests** (`src/routes/_authenticated/notes/-components/__test__/note-editor.test.tsx`):

- [x] Mounting with an unedited note issues no `updateContent.mutate` call, at mount and after advancing fake timers past 800 ms (the old autosave window).
- [x] Typing then advancing timers issues no save — autosave is gone (covered for both title and body).
- [x] Typing then blurring the pane to an outside element issues exactly one save with the expected title (content/plainText aren't independently asserted — the stubbed `TiptapEditor` doesn't exercise real ProseMirror JSON — but the same `flush()` payload path is covered by the `useUpdateNoteContentMutation` cache test).
- [x] Moving focus from the title to the body issues no save. (Body → title isn't separately tested — the stub's "body" is a static div, not a focusable input — but the underlying containment check is direction-agnostic, so this is the same code path.)
- [x] Blurring into an editor-owned portal (standing in for the slash/link/table menus, all marked `data-note-editor-portal`) and into the real delete confirmation dialog issues no save. (The tag popover isn't separately tested — it's a plain DOM descendant of the pane, not a portal, so it's already covered by the plain-containment tests.)
- [x] `Ctrl`+`S` and `Cmd`+`S` each save once and `preventDefault` the event (asserted via `dispatchEvent`'s return value).
- [x] Unmounting with unsaved edits saves; unmounting with none does not.
- [x] A rejected save leaves the component dirty and re-saves on the next trigger (proving the snapshot is not advanced optimistically).
- [x] A read-only note issues no save on any trigger, and never renders the save bar.
- [x] The header text follows idle → "Unsaved changes" → "Saving…" → "Saved".
- [x] The save bar is absent on mount, appears after typing, and unmounts after a successful save.
- [x] Clicking **Save** issues exactly one save (not two — proving the blur into the button is not read as leaving the pane). Focus-returns-to-editor isn't asserted — the stubbed `TiptapEditor` never wires `editorRef`, so it isn't observable at this level.
- [x] The button is disabled while a save is in flight, and a second click during flight issues nothing.
- [x] A rejected save leaves the bar visible in its `dirty` state with the button re-enabled.
- [x] Existing tests in this file continue to pass with their `useNotesFilters` mock from spec 16.

**Component tests** (`src/routes/_authenticated/notes/-components/__test__/unsaved-changes-bar.test.tsx`, new):

- [x] Renders "Unsaved changes" and an enabled **Save** in the `dirty` state; "Saving…" and a disabled button in `saving`.
- [x] Calls `onSave` once per click.
- [x] Exposes `role="status"` with a polite live region.

**Manual verification:**

- [ ] Open a note ending in a table with DevTools Network filtered to `notes` — confirm zero `PATCH` and that Undo/Redo are greyed out.
- [ ] Repeat for notes ending in a bullet list, a code block, and a paragraph.
- [ ] Type a sentence, wait five seconds, confirm no request; click the note list, confirm exactly one `PATCH`.
- [ ] Type, then `Cmd`/`Ctrl`+`S` — confirm the save happens, the browser's own save dialog does not, and the caret stays put.
- [ ] Type, then switch notes; switch back and confirm the edit is there.
- [ ] Type, then click Finance in the sidebar; return to `/notes` and confirm the edit persisted with no dialog shown.
- [ ] Type, then press `Cmd`/`Ctrl`+`R` — confirm the browser confirmation appears; cancel it and confirm the draft is intact.
- [ ] With no edits, reload and confirm no confirmation appears.
- [ ] In a note ending with a table, confirm the gap cursor lets you click below the table and start a new paragraph.
- [ ] Go offline, edit, blur, and confirm the error toast appears, the header still reads "Unsaved changes", and the bar is still there with **Save** enabled.
- [ ] Type a long note until the caret reaches the bottom of the viewport — confirm the bar does not cover the line being typed.
- [ ] Type, click **Save**, and confirm exactly one `PATCH`, the bar disappearing, and the caret back where it was.
- [ ] Check the bar in light and dark themes, and on a narrow mobile viewport (bar centred over the pane, clear of the home indicator).

## Open Questions

- [ ] `trailingNode: false` is the root fix, but it removes the always-present empty paragraph at the end of every note. Gapcursor covers placing the caret after a trailing table or code block, and this is worth confirming by hand (it is in the manual checklist) before committing to it. If the affordance feels worse, the fallback is to keep `TrailingNode` and instead ignore the first init-time transaction — strictly more code and more fragile, so only take it if the manual check fails.
- [x] Should "Unsaved changes" be more assertive than small grey text? Resolved: yes — the floating save bar is that assertive surface, and it carries the amber dot. The header text stays quiet and secondary.
- [ ] Should the bar auto-hide after a period of inactivity while still dirty, to stay out of the way in a long writing session? Starting with always-visible-while-dirty; revisit if it feels nagging, since a bar that hides while work is still unsaved undercuts the whole point.
- [ ] Does the bar belong in the shared `src/components/` tree rather than the notes slice? Kept feature-local for now per the feature-slices promotion rule — promote when a second feature (finance forms are the likely first) needs the same bar.
