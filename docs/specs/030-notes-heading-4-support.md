---
id: 30
title: 'First-Class Heading 4 in the Notes Editor'
status: in-progress
feature: notes
created: 2026-10-04
updated: 2026-10-04
---

# First-Class Heading 4 in the Notes Editor

## Problem Statement

Heading 4 half-exists in Second Brain. Typing `####` in the editor, or pasting markdown that contains it, produces a real `<h4>` — TipTap's `StarterKit` allows heading levels 1–6 and nothing in `createContentExtensions()` narrows that. But every surface built around the editor treats H4 as an accident: the slash menu offers only Heading 1–3, the editor stylesheet renders `h4` identically to `h3`, the outline rail draws it as an H3 entry, and PDF export prints it as H3. A user who writes a four-level document (`#` → `####`) gets a note whose bottom two levels are visually indistinguishable, cannot reach the fourth level from the slash menu, and loses the distinction entirely when exporting.

## Goals

- Make H4 a first-class level: reachable from the slash menu, visually distinct from H3 in the editor, and distinct in the outline and PDF export.
- Keep every existing note valid and unchanged — no migration, no schema change, no new attributes on heading nodes.
- Keep editor, outline, and PDF consistent on one rule for how heading levels beyond H4 are handled.

## Non-Goals

- **No H5/H6 as first-class levels.** They remain reachable only by markdown paste or typing `#####`, as today, and are clamped (to H4 instead of H3) wherever a visual treatment is needed.
- **No change to the schema's accepted levels.** Restricting `Heading` to `levels: [1, 2, 3]` was considered and rejected — see below.
- **No heading anchors, numbering, or collapsible sections.**
- **No new toolbar or bubble-menu control** for heading level; the slash menu and markdown input rules remain the only entry points.

## Design Decisions

### Support H4, don't forbid it

Two directions were possible: cap headings at H3 (`StarterKit.configure({ heading: { levels: [1, 2, 3] } })`) or promote H4 to a real level. Capping is cheaper but changes behavior for content that exists today. Pasted markdown with `####` would silently become a plain paragraph (the `#` characters appearing as literal text), and any saved note already containing an H4 would have the node dropped or coerced by ProseMirror on load, which `note-editor.tsx`'s by-value dirty check would then surface as a phantom "Unsaved changes". Promoting H4 changes nothing about what is stored and only improves how it is presented.

### H5–H6 clamp to H4

Spec 024 and spec 026 both clamp H4–H6 to H3. With H4 distinct, the clamp ceiling moves to 4 so that H5/H6 render as the deepest level that has a style. This is a one-line change in each of `clampLevel` (outline) and `clampHeadingLevel` (PDF); the stored level is never rewritten.

### Surface by surface

| Surface                        | Today                                                   | After                                                                                                  |
| ------------------------------ | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Schema                         | Levels 1–6 (StarterKit default)                         | Unchanged                                                                                              |
| Markdown input rule            | `####` + space → H4                                     | Unchanged                                                                                              |
| Slash menu                     | Heading 1–3                                             | Adds **Heading 4** (`keywords: ['h4']`, description "Minor section heading")                           |
| Editor stylesheet              | `h3, h4` share one rule (`styles.css`)                  | `h4` split out with its own size/weight so it reads below H3 (exact values chosen against the H3 rule) |
| Outline (`OutlineEntry.level`) | `1 \| 2 \| 3`, H4–H6 clamped to 3                       | `1 \| 2 \| 3 \| 4`, H5–H6 clamped to 4; H4 gets deeper indent and a shorter tick than H3               |
| PDF export                     | `h1`–`h3` styles, H4–H6 clamp to `h3`                   | Adds an `h4` style (bold, smaller than `h3`), `headlineLevel: 4`, H5–H6 clamp to 4                     |
| Content helpers                | `heading(level: 1 \| 2 \| 3, …)` in `tiptap-content.ts` | Unchanged — it only builds template content and has no H4 caller                                       |

## Acceptance Criteria

- [ ] Given the slash menu is open, when the user types `h4` or `heading 4`, then a "Heading 4" entry appears and selecting it converts the current block to a level-4 heading.
- [ ] Given a heading of each level 1–4 in one note, when it is rendered in the editor, then H3 and H4 are visibly different in size or weight.
- [ ] Given a note containing an H4, when it is opened and not edited, then no "Unsaved changes" bar appears (the node JSON is unchanged).
- [ ] Given a note with H1–H4 headings, when the outline renders, then each H4 is listed, indented deeper than H3, with a shorter tick, and clicking it scrolls to the right heading.
- [ ] Given a note with H5 or H6 headings, when the outline renders, then they are listed at the H4 depth and still scroll to the correct heading (`domIndex` is unaffected).
- [ ] Given a note with an H4, when exported to PDF, then it renders in the `h4` style, smaller than H3, and is never the last line on a page.
- [ ] Given a note with an H5 or H6, when exported to PDF, then it renders in the `h4` style.
- [ ] Given markdown pasted with `####`, when it is pasted into a note, then an H4 is produced (existing behavior is preserved).

## Data Model Changes

None. Heading `level` is already stored as a number from 1–6 in the existing ProseMirror JSON; no field, column, or store changes.

## UI / UX Notes

- Slash menu: add the entry after Heading 3 in `slash-command-extension.ts`, mirroring the existing three (`chain.setNode('heading', { level: 4 })`).
- Stylesheet: keep `h4` in the shared color/`scroll-margin-top` rule at `styles.css:315`, but remove it from the `h3, h4` spacing rule at `:332` and give it its own.
- Outline: `note-outline.tsx` currently branches on `entry.level === 3` in three places (row padding, tick height, label size) and once more in the mobile list. Replace the equality checks with a small level-to-style map so H4 doesn't add a fourth ternary.
- The outline's width and the "full-width tick for H1/H2, half-width for H3" depth rule in spec 024 extend naturally: H4 gets the shortest tick and the deepest indent.

## Edge Cases

- **Existing notes with H4–H6:** render, outline, and export without any stored change; only presentation differs.
- **Empty H4:** counted in `domIndex` like any other empty heading and filtered from the outline, per spec 024.
- **H4 inside a callout or table cell:** same as other headings; the outline walks into both.
- **Outline `domIndex` alignment:** unaffected — the DOM query already matches `h1`–`h6`.

## Implementation Notes

1. `src/routes/_authenticated/notes/-components/slash-command-extension.ts` — add the Heading 4 command.
2. `src/styles.css` — split `h4` out of the `h3, h4` rule.
3. `src/routes/_authenticated/notes/-types/notes-outline.ts`, `-utils/note-outline.ts` — widen `level` to `1 | 2 | 3 | 4`, raise the clamp ceiling to 4.
4. `src/routes/_authenticated/notes/-components/note-outline.tsx` — level-to-style map covering the desktop rail and mobile list.
5. `src/routes/_authenticated/notes/-utils/pdf-document.ts` — add the `h4` style.
6. `src/routes/_authenticated/notes/-utils/tiptap-to-pdf.ts` — widen `clampHeadingLevel` to return up to 4.
7. Amend specs 024 and 026 (below) and `docs/second-brain.md` (slash menu list at "Text, Heading 1–3, …" and the heading input-rule line) when this ships.

## Test Plan

**Unit tests** (`src/routes/_authenticated/notes/-utils/__test__/`):

- [ ] `note-outline.test.ts` — level 4 is preserved; levels 5 and 6 clamp to 4; `domIndex` is unchanged.
- [ ] `tiptap-to-pdf.test.ts` — level 4 maps to `style: 'h4'`, `headlineLevel: 4`; levels 5–6 clamp to 4. (The test's local mirror of the clamp at `:44` must be updated alongside.)

**Component tests** (`src/routes/_authenticated/notes/-components/__test__/`):

- [ ] `note-outline.test.tsx` — an H4 entry renders with the deeper-indent treatment.
- [ ] Slash menu — "Heading 4" appears and converts a block to level 4.

**Manual verification:**

- [ ] Type `#### ` and use `/h4`; both produce an H4 that looks smaller than H3.
- [ ] Open an existing note with an H4; confirm no unsaved-changes bar.
- [ ] Export a note with H1–H4 to PDF; confirm four distinct heading sizes.

## Open Questions

- [x] Should H4 differ from H3 by size, weight, or both? Proposal: slightly smaller and semibold rather than bold, so it reads as a run-in label — to be settled against the live H3 rule. **Resolved:** both — prose-sm already sizes H4 below H3, and the H4 rule adds `font-semibold`.
- [x] Should H5/H6 clamp to H4 (proposed) or stay clamped to H3 as in specs 024/026, with H4 only for level 4 exactly? Clamping to H4 keeps "deeper never looks shallower than H4". **Resolved:** clamp to H4.

## Amendments

### 2026-10-04 — Outline nests by relative depth; Heading 1 leaves the slash menu

**What happened:** with H4 in place, the outline showed H1 and H2 at the same indent (spec 024 gave both a full-width tick and no indent), so an H2 under an H1 did not read as nested. Separately, the note title is its own field and already acts as the page's H1, so offering "Heading 1" in the body slash menu invites a second, competing top level.

**Decision:**

- **Outline indents by depth, not by absolute level.** Depth is `level − (shallowest level in the note)`, so every level gets its own indent step (rail `pl-1.5 / pl-4 / pl-6 / pl-8`, mobile `pl-2 / pl-5 / pl-8 / pl-11`). A note whose headings start at H2 puts H2 at the left edge instead of opening with an empty step. Depth 0 keeps the full tick and 13px label; deeper entries use the short tick and 12px label. This supersedes spec 024's "H1 and H2 get a full-width tick, H3 a half-width one".
- **"Heading 1" is removed from the slash menu.** The schema still accepts level 1: existing H1s, `# ` typed in the editor, and pasted `#` markdown keep working, so no stored note changes and no phantom "Unsaved changes" appears. Capping the schema at `levels: [2, 3, 4]` was rejected for the same reason the H3 cap was (see "Support H4, don't forbid it").

**Superseded:** the Surface table's slash-menu row now reads "Heading 2–4".
