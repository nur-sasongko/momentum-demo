---
id: 24
title: 'Note Outline: A Proportional Table of Contents for Second Brain'
status: in-progress
feature: notes
created: 2026-08-20
updated: 2026-10-04
---

# Note Outline: A Proportional Table of Contents for Second Brain

## Problem Statement

A note in Second Brain is one continuous scroll. Once it grows past a screen or two, the only way to reach a section is to drag the scrollbar and read as it goes past — there is no way to see what sections a note contains without scrolling through it, no way to jump to one, and no indication of where in the document you currently are. The editor already supports H1–H3 through the slash menu and markdown input rules, so the structure exists in every long note; it is simply never surfaced. Long reference notes (the ones most worth keeping) are the ones this hurts most.

## Goals

- Show the headings of the open note as a navigable outline, always visible on wide screens.
- Let the user jump to any section in one click, from both editable and read-only notes.
- Show where in the document the reader currently is, and update it as they scroll.
- Convey **section length**, not just section order — a reader should be able to see the shape of a note before reading it.
- Cost nothing when the note has no headings, and cost no horizontal space when the viewport cannot spare it.
- Add no attributes to heading nodes and no columns to the database — the outline is derived, never stored.

## Non-Goals

- **No heading anchors or shareable `#fragment` URLs.** The outline is in-pane navigation only; `?note=<id>` stays the whole address.
- **No section folding.** Clicking an outline entry navigates; it never collapses document content.
- **No drag-to-reorder sections.** Reordering the outline does not rewrite the document.
- **No outline in the archived-notes sheet or the note list.** Only the open note in `NoteEditor`.
- **No new heading levels.** H4–H6 remain absent from the slash menu; they are only ever produced by markdown paste.
- **No per-note scroll position persistence.** Reopening a note starts at the top, as it does today.
- **No changes to the notes schema, queries, or save pipeline.** This spec touches rendering and local UI state only.

## Design Decisions

### The outline is derived from JSON, never from stored heading IDs

The obvious implementation — extend `Heading` with an `id` attribute so entries can link to `#slug` — is unsafe here. `note-editor.tsx` detects unsaved changes by value:

```ts
// note-editor.tsx:47
function draftsEqual(a: Draft, b: Draft): boolean {
  return (
    a.title === b.title &&
    JSON.stringify(a.content) === JSON.stringify(b.content)
  )
}
```

`handleEditorReady` exists specifically to re-baseline the draft against ProseMirror's post-parse JSON, because attribute defaults that appear at parse time would otherwise read as an edit. Adding a rendered `id` attribute to `heading` puts a new key in `getJSON()` output for every existing note, which either surfaces a phantom "Unsaved changes" bar on open or triggers a write on blur. Neither is acceptable for a feature that is supposed to be read-only in effect.

So the outline is derived from `JSONContent` — which `NoteEditor` already holds in `draft.content` — and resolved to DOM elements positionally.

### Entries map to DOM by document order

`extractOutline(content)` walks the document depth-first and assigns each heading node a `domIndex`, counting **every** heading it encounters including empty ones. Empty headings are then filtered out of the returned list, but the surviving entries keep their original index.

At render time the rail resolves elements with `editor.view.dom.querySelectorAll('h1, h2, h3, h4, h5, h6')`, which returns nodes in the same depth-first document order. Entry _n_ is element `domIndex[n]`.

Two things make this invariant safe:

- The query is scoped to `editor.view.dom` (the `.note-tiptap` element), not the pane — so the bubble menus, table context menu, and slash-command portals that render as siblings of `EditorContent` cannot contaminate the list.
- Headings can only nest inside `Callout` (`content: 'block+'`) and table cells, both of which render through plain `renderHTML` into the document flow. No node view reorders or portals its children out of the editor root.

If the two lists ever differ in length, the rail renders from the shorter one and skips scroll resolution for the remainder rather than jumping to the wrong section.

### Recompute on blur and save, not on keystroke

_Decided 2026-08-20._

The outline recomputes at three moments:

1. `TiptapEditor.onReady` — first paint of a note.
2. `TiptapEditor.onBlur` — the user left the writing surface (clicked the title, the rail, the toolbar, another pane).
3. A successful content save — inside the existing `flush` `onSuccess` callback.

It does **not** recompute per keystroke. Typing `## ` and then a title would otherwise make the rail grow a nameless tick and re-flow on every character, which is visual noise in the exact moment the user is not looking at it. The cost is one accepted edge case, documented below: a heading typed and immediately clicked in the rail is not there on the first click.

Because `NoteEditor` and `TiptapEditor` are both keyed on `note.id`, switching notes remounts them and the outline resets with no explicit teardown.

### Click behavior depends on whether the note is editable

_Decided 2026-08-20._

| Note state            | Click on an outline entry                                                              |
| --------------------- | -------------------------------------------------------------------------------------- |
| `isReadOnly === true` | Scroll the pane to the heading. Focus stays on the outline button.                     |
| editable              | Scroll, then place the cursor at the start of the heading's text and focus the editor. |

Read-only notes are the reading case — stealing focus into a surface the user cannot type in is pointless and loses their place in the rail for keyboard navigation. Editable notes are the writing case, where landing the caret in the section is what the user actually wanted.

Scrolling targets `element.offsetTop - 24` on the pane's scroll container, with `behavior: 'smooth'` unless `prefers-reduced-motion: reduce` matches, in which case `'auto'`.

### The scroll root is the pane, not the window

Scroll-spy and scroll-to must both target the `overflow-y-auto` div at `note-editor.tsx:389`, which owns the note's scroll. It needs a ref, passed to the outline. Two consequences:

- Active-section tracking uses a rAF-throttled `scroll` listener on that element rather than `IntersectionObserver`. The question being answered is "which section am I inside", which is a threshold comparison against `scrollTop`, not a visibility question — the active entry is the last heading whose `offsetTop` is `<= scrollTop + 96`. `IntersectionObserver` answers "which headings are on screen", which is a different and less useful question when a section is taller than the viewport.
- Measured offsets are cached on recompute and invalidated by a `ResizeObserver` on `editor.view.dom`, so images finishing their load and tables reflowing do not leave the rail pointing at stale positions. The `pb-20` that `note-editor.tsx` adds while the save bar is up changes `scrollHeight`, and the same observer catches it.

### The signature: a proportional spine

An evenly spaced indented list is the default answer and it discards information the document already has. Instead, each outline row grows in proportion to how much of the document its section occupies:

```css
/* per row, computed from measured heading offsets */
flex-grow: <section height / document height>;
min-height: 1.75rem;
```

A three-line intro and a three-screen middle section then look different in the rail. Flexbox does the collision handling that hand-positioned ticks would need: short sections settle onto the `1.75rem` floor, long ones stretch, and a note dense enough that every row hits the floor degrades gracefully into an ordinary evenly-spaced list — which is the honest rendering at that density, since proportion conveys nothing once everything is equal. The rail scrolls on its own axis if it overflows.

Depth is carried by tick length rather than indentation alone: H1 and H2 get a full-width tick, H3 (and clamped H4–H6) a half-width one.

Progress is a number in the header — `42%`, in IBM Plex Mono per the `--font-numeric` role established in [spec 020](./020-core-design-system-refresh.md) — and **not** a floating marker on the rail. A marker positioned at an exact scroll percentage would drift away from the ticks, whose positions flexbox has adjusted; the two live in different coordinate spaces and pretending otherwise would look broken. Instead the rail segments up to and including the active section render in `--primary` and the rest in `--border`. That reads as progress without claiming pixel accuracy it does not have.

### Three responsive states, one component

| Viewport               | State                                                                                 | Width          |
| ---------------------- | ------------------------------------------------------------------------------------- | -------------- |
| `xl` and up (≥ 1280px) | Expanded rail with labels                                                             | `w-56` (224px) |
| `md`–`xl`              | Collapsed to a tick gutter; hover or `:focus-within` floats the labels over the prose | `w-6` (24px)   |
| below `md`             | Rail hidden; a floating action button opens a `Popover` with a flat list              | —              |

The space budget forces this. At 1280px with the app sidebar expanded, `16rem` sidebar + `w-80` note list leaves 704px for the editor; a 224px rail brings the prose measure to ~480px, which is the floor for comfortable reading. Below that the rail has to give the width back.

At `xl` and up the user can also collapse the rail manually, and that choice persists.

### The mobile trigger is a floating action button, not a header icon

_Decided 2026-08-21._

The editor header below `md` already carries the back button, the tag input, and four icon buttons — undo, redo, favorite, lock, archive. A sixth icon for the outline (`ListTree`) either wraps that row on a narrow phone or steals width from the tag input, the one element in it that actually benefits from space. It also buries a "there's more here" affordance among unrelated meta and destructive actions, at the top corner of the screen — the least reachable spot for a one-handed grip, for a control whose entire job is mid-read navigation.

The trigger moves out of the header and becomes a floating action button, fixed to the bottom-right corner of the viewport: `fixed bottom-6 right-6 z-40 h-14 w-14 rounded-full shadow-lg`, `default` button variant, `ListTree` icon, `aria-label="Outline"` unchanged. This is not a new pattern for the app — it is the exact geometry `TaskAddFab` already uses (`src/routes/_authenticated/tasks/-components/task-add-fab.tsx:22`). Reusing it means the outline trigger reads as "the app's floating button," not a second, competing convention.

**Considered and rejected: a progress ring around the button.** `outline.progress` is already computed and already has a token pairing (`--primary` on `--border`) established for exactly this value, so a ring would reuse that pairing legitimately. But this spec already made the opposite call once, for the same reasoning, in a different shape — "Progress is a number in the header … and not a floating marker on the rail" (see "The signature: a proportional spine," above). `TaskAddFab` is also a plain filled circle with no decoration. Putting a ring on the one floating button in the app that has one breaks that precedent for a gain that's mostly decorative. The percentage stays meaningful, so it moves into the popover header instead (see Copy, below) — the same place the desktop rail already puts it, not painted onto the trigger itself.

**Positioning conflict with the save bar.** `UnsavedChangesBar` is centered at `bottom-4` and can span up to `calc(100%-2rem)` (`src/components/unsaved-changes-bar.tsx:20`); the floating button sits right-anchored at `bottom-6`. On a phone-width viewport the two overlap whenever both are visible — an editable note, mid-edit, with headings. The scroll pane already solves the equivalent problem for the prose (`pb-20` while `showSaveBar` is true, in `note-editor.tsx`); the button gets the same treatment: `bottom-24` instead of `bottom-6` while the save bar is showing. Not a new mechanism — a second consumer of a rule the save bar already imposes on its neighbors.

**The popover opens upward.** The trigger used to live at the top of the pane, so the popover opening downward was correct by default. From a bottom-right floating button, `side="top"` has to be set explicitly on `PopoverContent` — left at its default (`bottom`), it would try to open below a trigger that has no room below it.

### Tokens and type

Every value already exists in `src/styles.css`; this spec adds no tokens.

| Element                     | Token                        |
| --------------------------- | ---------------------------- |
| Rail, inactive segments     | `--border`                   |
| Rail, segments up to active | `--primary`                  |
| Active tick and label       | `--primary` / `--foreground` |
| Inactive labels             | `--muted-foreground`         |
| Row hover                   | `--muted`                    |
| Focus ring                  | `--ring`                     |

Labels are Inter — 13px for H1/H2, 12px for H3 — truncated to one line with the full text in a `title` attribute. The progress percentage is the only mono on the panel, and it is the only real quantity on it. No word counts, no `01 / 02 / 03` markers: the outline's order carries no meaning that the indentation does not already show, so numbering it would be decoration.

Motion is limited to the active tick growing and its label shifting 2px, plus the smooth scroll on click. Both are gated behind `prefers-reduced-motion`.

## Acceptance Criteria

- [ ] Given a note containing H1–H3 headings, when it is opened at `xl` width, then an outline rail appears at the right edge of the editor pane listing every non-empty heading in document order.
- [ ] Given a note with no headings, when it is opened, then no rail, no gutter, and no mobile outline button render, and the prose keeps the full pane width.
- [ ] Given an outline entry, when it is clicked on a read-only note, then the pane scrolls that heading to just below the top of the viewport and focus remains on the outline button.
- [ ] Given an outline entry, when it is clicked on an editable note, then the pane scrolls to the heading and the caret lands at the start of the heading's text.
- [ ] Given a note longer than the viewport, when the user scrolls, then the entry for the section containing the current scroll position is marked active and carries `aria-current="location"`, and exactly one entry is active at a time.
- [ ] Given a scrolled note, when the scroll position changes, then the header percentage updates to the scroll progress through the pane.
- [ ] Given the rail, when a section occupies more of the document than another, then its row is taller, subject to a `1.75rem` floor.
- [ ] Given a user typing a new heading, when they are still typing, then the rail does not change; when they blur the editor or the note saves, then the rail includes the new heading.
- [ ] Given an editable note, when the outline recomputes on blur, then no save is triggered and no "Unsaved changes" bar appears as a result.
- [ ] Given a note opened before and after this change, when `getJSON()` is compared, then the output is byte-identical — no heading attributes were added.
- [ ] Given a viewport between `md` and `xl`, when the note has headings, then the rail renders as a 24px tick gutter, and hovering it or tabbing into it reveals the labels floating over the prose.
- [x] Given a viewport below `md`, when the note has headings, then a floating action button appears fixed at the bottom-right of the screen and opens a popover, anchored above the button, listing the headings. (`NoteOutlineMobileMenu`, 2026-08-21 amendment.)
- [x] Given a viewport below `md` with an editable note, when the save bar becomes visible, then the floating button moves from `bottom-6` to `bottom-24` so the two never overlap. (`isRaised` prop wired to `showSaveBar`.)
- [x] Given a viewport below `md`, when the outline popover opens, then its header shows the same read-progress percentage as the desktop rail. (`progress` prop rendered in the popover header.)
- [ ] Given the rail is collapsed by the toggle at `xl`, when the page is reloaded, then it is still collapsed.
- [ ] Given a keyboard user, when they tab into the rail, then labels are visible, focus is ringed with `--ring`, and Enter or Space activates the focused entry.
- [ ] Given `prefers-reduced-motion: reduce`, when an entry is clicked, then the scroll jumps without animation and the active-tick transition does not play.
- [ ] Given a note whose headings sit inside a callout or a table cell, when the outline renders, then those headings appear in the rail and clicking them scrolls to the correct element.
- [ ] Given a note containing H4–H6 from a markdown paste, when the outline renders, then those headings appear at H3's indent level rather than being dropped.

## Data Model Changes

**Store:** `src/stores/notes-store.ts`

`notes-store` is currently unpersisted. It gains one persisted UI preference, wrapped with `persist` following the `finance-store` pattern — `partialize` is required here because `linkTargets` is server data that must never be written to `localStorage`.

```ts
interface NotesState {
  linkTargets: NoteSummary[]
  setLinkTargets: (targets: NoteSummary[]) => void

  isOutlineCollapsed: boolean
  setOutlineCollapsed: (collapsed: boolean) => void
}

export const useNotesStore = create<NotesState>()(
  persist(
    (set) => ({
      linkTargets: [],
      setLinkTargets: (targets) => set({ linkTargets: targets }),
      isOutlineCollapsed: false,
      setOutlineCollapsed: (collapsed) =>
        set({ isOutlineCollapsed: collapsed }),
    }),
    {
      name: 'momentum-notes',
      version: 1,
      partialize: (state) => ({ isOutlineCollapsed: state.isOutlineCollapsed }),
    },
  ),
)
```

**Migration:** New store key at `version: 1`. No prior persisted state exists under `momentum-notes`, so no `migrate` function is needed.

**New type:** `src/routes/_authenticated/notes/-types/notes-outline.ts`

```ts
export interface OutlineEntry {
  /** 1–3; H4–H6 are clamped to 3. */
  level: 1 | 2 | 3
  text: string
  /** Ordinal among all heading nodes in the document, empty ones included. */
  domIndex: number
}
```

No database, query, or `Note` type changes.

## UI / UX Notes

Expanded, at `xl` and up:

```
┌─ NoteList (w-80) ─┬─ NoteEditor ─────────────────────────┬─ Outline (w-56) ─┐
│ 🔍 search          │ #tags            ↺ ↻ ★ 🔓 🗑         │                  │
│ ───────────────    │ ──────────────────────────────────── │ ON THIS PAGE 42% │
│ ▸ Supabase RLS     │ Supabase RLS                         │                  │
│   2h                │ Last edited 2h ago                   │ ▬ Intro          │
│ ▸ Weekly review    │                                      │ │                │
│ ▸ Reading list     │ ## Intro                             │ ▬ Policies       │  ← active
│                    │ Short paragraph.                     │ ┃                │
│                    │                                      │ ▭  Row-level     │
│                    │ ## Policies                          │ ┃                │
│                    │ …several screens…                    │ ▭  Bypass        │
│                    │                                      │ ┃                │
│                    │ ### Row-level                        │ │                │
│                    │ …                                    │ ▬ Rollout        │
└────────────────────┴──────────────────────────────────────┴──────────────────┘
     Rail segments are ─ up to the active entry, │ below it.
     Row height is proportional to section length: "Intro" is short, "Policies" is long.
```

Collapsed gutter (`md`–`xl`, or toggled off at `xl`), expanding on hover or `:focus-within`:

```
   │                    │  ON THIS PAGE  42%
   ▬                    ▬  Intro
   │        hover   →   │
   ▬                    ▬  Policies
   ┃                    ┃
   ▭                    ▭    Row-level
   ┃                    ┃
   ▭                    ▭    Bypass
   │                    │
   ▬                    ▬  Rollout
  24px                 224px, floated over the prose
```

Below `md` — no outline control in the header; a floating button replaces it, and its popover opens upward from the button rather than down from the header:

```
┌──────────────────────────────┐
│ ←  #tags          ↺ ↻ ★ 🔓 🗑  │  ← no outline icon here anymore
├───────────────────────────────┤
│ Supabase RLS                  │
│ Last edited 2h ago             │
│                                │
│ ## Intro                      │
│ Short paragraph.                │
│                                │
│ ## Policies                   │
│ …several screens…               │
│                                │
│                    ┌──────────┐│
│                    │ On this  ││
│                    │ page  42%││
│                    │ ▬ Intro  ││
│                    │ ▬ Policies││
│                    └──────────┘│
│                            ╭──╮│
│                            │☰ │ │ ← floating button, bottom-right
│                            ╰──╯│
└───────────────────────────────┘
     Popover opens above the button (`side="top"`); the button itself
     lifts from bottom-6 to bottom-24 while the save bar is visible.
```

**Copy.** Header label: `On this page`. Collapse toggle: `Hide outline` / `Show outline`. Mobile trigger: `aria-label="Outline"`, unchanged by the move to a floating button. The popover header now reads `On this page` with the same tabular-mono percentage the desktop rail shows — mobile never surfaced this number before (`NoteOutlineMobileMenu` didn't accept a `progress` prop), so this closes a parity gap rather than adding new information. There is no empty state — a note with no headings renders no outline at all, and no floating button either, rather than an empty panel explaining itself.

**Markup.** `<nav aria-label="Note outline">` containing a list of `<button>` elements — not anchors, since there is no URL fragment to point at. The active entry carries `aria-current="location"`. In the collapsed state the buttons stay in the DOM with their accessible names intact and the labels are visually clipped, so `:focus-within` expanding the rail gives keyboard users the labelled panel automatically. The collapse toggle carries `aria-expanded`. The floating trigger below `md` is a single `<button aria-label="Outline">` outside the `<nav>`, exactly as the header button was — only its position and container changed.

The rail renders inside `<section ref={paneRef}>`, so clicking it never trips `handlePaneBlur`'s "left the pane" check and never triggers a save.

## Edge Cases

- **No headings:** nothing renders — no rail, no gutter, no floating button. The prose keeps the full pane width.
- **Save bar visible while the floating button would show:** the button lifts from `bottom-6` to `bottom-24` so it never overlaps `UnsavedChangesBar`'s centered pill.
- **Empty headings:** a heading node with no text is skipped in the rail but still counted for `domIndex`, so the mapping to DOM elements does not shift.
- **A heading typed then immediately clicked:** blur fires before click, so the recompute has run by the time the handler executes — but the entry did not exist under the pointer at mousedown. Accepted: the click lands on whatever entry now occupies that position, or on nothing. This is the documented cost of not recomputing per keystroke.
- **Headings nested in a callout or table cell:** included, since both render into document flow through plain `renderHTML`.
- **H4–H6 from markdown paste:** clamped to level 3 rather than dropped, so pasted content does not silently lose structure.
- **Entry and element counts disagree:** render the shorter list and skip scroll resolution beyond it, rather than scrolling to a wrong section.
- **Images or tables finishing layout after measurement:** the `ResizeObserver` on `editor.view.dom` invalidates cached offsets.
- **Save bar appears while scrolled:** `pb-20` changes `scrollHeight`; the same observer re-measures, so the progress percentage stays correct.
- **Note is archived while open:** unchanged from today — `notes/index.tsx` already falls back to the first live note, and the remount resets the outline.
- **Persistence boundary:** only `isOutlineCollapsed` survives reload. Active entry, scroll position, and measured offsets are all recomputed on mount.

## Implementation Notes

1. `src/stores/notes-store.ts` — wrap in `persist`, add `isOutlineCollapsed` / `setOutlineCollapsed`, `partialize` to the preference only.
2. `src/routes/_authenticated/notes/-types/notes-outline.ts` — `OutlineEntry`.
3. `src/routes/_authenticated/notes/-utils/note-outline.ts` — `extractOutline(content: JSONContent): OutlineEntry[]`, depth-first, clamping levels and assigning `domIndex`. Pure; no DOM.
4. `src/routes/_authenticated/notes/-utils/use-note-outline.ts` — takes the scroll container ref, the editor ref, and the entries; measures heading offsets, owns the `ResizeObserver` and the rAF-throttled scroll listener, returns `{ activeIndex, progress, scrollTo }`. (Originally returned `rowFlex` too for proportional row heights — dropped, see the 2026-08-20 amendment.)
5. `src/routes/_authenticated/notes/-components/note-outline.tsx` — the rail: expanded, collapsed gutter, and the mobile trigger, driven by `useIsMobile` and an `xl` media query. The mobile trigger becomes a fixed floating button (`fixed bottom-6 right-6 z-40 h-14 w-14 rounded-full shadow-lg`, matching `task-add-fab.tsx`) instead of a header icon; it takes an added `progress: number` prop (shown in the popover header) and an `isRaised: boolean` prop that switches its position to `bottom-24`; `PopoverContent` gets an explicit `side="top"`.
6. `src/routes/_authenticated/notes/-components/tiptap-editor.tsx` — add an `onBlur` prop, wired to `useEditor`'s `onBlur`.
7. `src/routes/_authenticated/notes/-components/note-editor.tsx` — add a ref to the scroll container, hold `entries` state, recompute on ready / blur / save success, split the scroll region into prose + rail, render the mobile floating trigger as a sibling of `NoteOutline` inside the pane (not inside the header row), passing `outline.progress` and `showSaveBar` through to it.
8. `src/styles.css` — `scroll-margin-top` on `.note-tiptap :where(h1, h2, h3, h4, h5, h6)` so smooth scrolling does not tuck a heading under the pane header.
9. `CHANGELOG.md` — entry under `## [Unreleased]` → `### Added`.
10. `docs/second-brain.md` — update the editor-architecture and layout sections once this spec is `done`.

## Test Plan

**Unit tests** (`src/routes/_authenticated/notes/-utils/__test__/note-outline.test.ts`):

- [ ] `extractOutline` returns entries in document order for a flat H1/H2/H3 document
- [ ] `extractOutline` clamps H4–H6 to level 3
- [ ] `extractOutline` skips empty headings but keeps `domIndex` aligned with the full heading count
- [ ] `extractOutline` finds headings nested inside a callout and inside a table cell
- [ ] `extractOutline` returns `[]` for a document with no headings and for an empty document
- [ ] `extractOutline` concatenates multiple text nodes in one heading, including marked text, into a single label

**Component tests** (`src/routes/_authenticated/notes/-components/__test__/note-outline.test.tsx`):

- [ ] Renders one button per entry, labelled with the heading text
- [ ] Renders nothing when `entries` is empty
- [ ] Marks the active entry with `aria-current="location"` and no other entry
- [ ] Clicking an entry on a read-only note calls the scroll handler and does not focus the editor
- [ ] Clicking an entry on an editable note calls both scroll and cursor placement
- [ ] Collapse toggle flips `aria-expanded` and writes `isOutlineCollapsed` to the store
- [ ] Mobile floating trigger renders at `bottom-24` when `isRaised` is true and `bottom-6` otherwise
- [ ] Mobile popover header shows the `progress` value passed in

**Component tests** (`note-editor.test.tsx`, extending the existing file):

- [ ] Editor blur triggers an outline recompute and does not call the content mutation
- [ ] Typing into the editor does not change the rendered outline until blur

**Manual verification:**

- [ ] Open a long note at `xl` width; confirm long sections have taller rows than short ones
- [ ] Scroll from top to bottom; confirm the active entry advances once per section and the percentage reaches 100%
- [ ] Narrow the window past `xl`; confirm the rail collapses to a gutter and hovering it floats the labels
- [ ] Narrow past `md`; confirm the rail is gone and a floating `Outline` button appears at the bottom-right of the screen, not in the header
- [ ] On a narrow viewport, type into a note until the save bar appears; confirm the floating button moves above it rather than overlapping
- [ ] On a narrow viewport, open the outline popover; confirm it opens upward from the button and its header shows the same percentage as the desktop rail
- [ ] Lock a note (read-only) and click an entry; confirm no caret appears and no save fires
- [ ] Type a new `## heading`, click into the title field, confirm the rail picks it up and the "Unsaved changes" bar behaves exactly as before
- [ ] Toggle the rail off, reload the page, confirm it is still off
- [ ] Enable "Reduce motion" in system settings; confirm clicks jump instead of animating
- [ ] Open a note with no headings; confirm the prose uses the full pane width

## Open Questions

- [ ] Should the collapse preference be global or per-note? Specced as global — per-note means a new persisted map keyed by note id for marginal benefit. Revisit only if it feels wrong in use.
- [x] Is `1.75rem` the right minimum row height? Resolved by the 2026-08-20 amendment below — `1.75rem` is now the row height, full stop, not a floor.

## Amendments

### 2026-08-20 — Fixed-height rows replace the proportional spine

**What happened:** the first real note run against this (a short, three-heading note in a tall editor pane) showed the "Design Decisions > The signature: a proportional spine" section behaving exactly as specced, and specced wrong. `flex-grow` distributes a flex container's _entire_ cross-axis space among its children in the given ratios — it has no concept of the document's actual height, only the rail's. A short note in a tall pane doesn't leave the rail's leftover space empty at the bottom; it stretches every row's ratio to fill the full pane height, so a section with a few lines of content renders as a large, mostly-empty box with its label stranded near the vertical center instead of at the top. The design's stated purpose — "conveying section length" — was true in principle but unreadable in practice, and short notes (a screen or less) are the common case for a personal notes app, not the edge case the design implicitly assumed.

**Decision:** drop proportional row heights. Every row gets a fixed height (`h-7`, 1.75rem), full stop — not a floor with room to grow. Depth is still carried by tick length (H1/H2 full, H3 half) and indentation, unaffected by this change. The read-progress fill (ticks up to and including the active entry render in `--primary`, the rest in `--border`) is also unaffected and remains the rail's signature element — it doesn't depend on row height, only on tick color, and reads correctly regardless of how long or short the note is.

**Superseded:**

- The "Design Decisions > The signature: a proportional spine" section above is kept verbatim as a historical record of what was tried and why it didn't hold up. It no longer describes the shipped behavior.
- Acceptance criterion _"Given the rail, when a section occupies more of the document than another, then its row is taller, subject to a `1.75rem` floor"_ is dropped.
- Manual verification step _"Open a long note at `xl` width; confirm long sections have taller rows than short ones"_ is replaced by: confirm every row renders at the same height regardless of section length, including in a short note inside a tall pane (the exact case that surfaced this).

**Implementation:** `use-note-outline.ts` no longer tracks `documentBottom` or computes `rowFlex` — it only measures heading offsets for scroll-spy and reading progress. `note-outline.tsx`'s row is a plain `h-7 shrink-0` element instead of an inline `flexGrow` style. `note-editor.tsx` and the outline's own tests no longer pass or expect a `rowFlex` prop.

### 2026-08-20 — Active-heading tracking never actually ran

**What happened:** the active entry (and the whole scroll-spy / reading-progress mechanism) never updated while reading a note — only the first entry ever showed as active, permanently. Root cause: `note-editor.tsx` read `editorRef.current` directly during render to feed `useNoteOutline`, but `editorRef.current` is only ever assigned inside `TiptapEditor`'s own `useEffect`, which runs after commit. Mutating a ref never re-renders whoever reads it, so unless some _unrelated_ state update happened to re-render `NoteEditor` after that effect committed (in practice: the user typing something), `useNoteOutline` kept receiving `editor: null` forever. With `editor` always `null`, `measure()` never populated real heading offsets, so `updateScrollState()`'s scroll handler always hit its `offsets.length === 0` guard and never advanced `activeIndex` past its initial `0` — for a note that's only ever scrolled, never edited, which is the common case for reading, not just an edge case.

**Decision:** give `TiptapEditor` an `onEditorChange?: (editor: Editor | null) => void` prop, called from the same effect that assigns `editorRef.current` (and with `null` on cleanup). `note-editor.tsx` tracks the editor in a new `liveEditor` state variable (`onEditorChange={setLiveEditor}`) and passes `liveEditor` — not `editorRef.current` — into `useNoteOutline`. `editorRef` itself is unchanged and still used for the imperative undo/redo/focus calls, which are read inside event handlers (always safe) rather than during render.

**Implementation:** `tiptap-editor.tsx` adds the `onEditorChange` prop. `note-editor.tsx` adds `liveEditor` state and wires it through. New regression test `tiptap-editor.test.tsx` mounts the real component and asserts `onEditorChange` fires with a live editor on mount (no interaction required) and with `null` on unmount.

### 2026-08-20 — Scroll-spy has no signal in a note that fits on screen

**What happened:** with the previous fix in place, active-tracking worked for long notes but was still stuck on one entry for short ones — clicking into a different heading's section did nothing, exactly reproducing the original complaint but for a different underlying reason. `updateScrollState`'s active-heading formula is "the last heading whose measured offset is at or before `scrollTop + 96px`". That's really "the last heading within the top 96px of the current viewport" (the `scrollTop` terms cancel out algebraically), which only sweeps across every heading's position if there's enough scroll range for `scrollTop` to grow past each one. In a note short enough to fit on screen without scrolling, `scrollTop` is pinned at `0` forever, so the anchor line never reaches past whichever headings happen to sit within the first 96px of the pane — commonly none of them, since the title and "Last edited" line alone push the first heading below that. The loop's `next` then never advances past its initialized `0`, regardless of where the reader clicks — scroll position was simply never going to be a usable signal for a page short enough to view all at once.

**Decision:** track the ProseMirror **selection** as a second, independent driver of `activeIndex`, alongside (not instead of) the existing scroll listener. `getHeadingPositions(editor)` walks `editor.state.doc.descendants(...)` for each heading's document position (in the same order as `domIndex`), and on every `editor.on('selectionUpdate', ...)` the active entry becomes the last heading at or before the current selection. Clicking into a section — or arrow-keying through one — moves the selection even when nothing scrolls, so this covers exactly the gap scroll-spy can't. Both listeners write the same `activeIndex` state; whichever fires last wins, which matches what a reader would expect (scroll while reading a long note, click while placing a cursor).

**Implementation:** `use-note-outline.ts` adds `getHeadingPositions()` and a `selectionUpdate` effect. New test `use-note-outline.test.ts` drives a real headless `Editor` (no React mount, no DOM measurement — jsdom's zero-sized layout can't exercise the scroll path meaningfully) with `scrollRef.current: null` to isolate the behavior, and confirms `activeIndex` follows the selection between two headings with no scrolling involved.

### 2026-08-21 — Mobile trigger implemented as a floating action button; its crowding argument is now stale

**What happened:** "The mobile trigger is a floating action button, not a header icon" (Design Decisions, above) was decided but not yet built when
[`025-notes-workspace-layout.md`](./025-notes-workspace-layout.md) started. That spec rebuilds the same mobile header this decision's first argument was reasoning about — "the header already carries the back button, the tag input, and four icon buttons … a sixth icon would wrap that row or steal width from the tag input" — and deletes the tag input and three of the four icon buttons. Built together, the two specs' outline work landed as: `note-outline.tsx`'s `NoteOutlineMobileMenu` now renders a `fixed bottom-6/24 right-6` button matching `task-add-fab.tsx`'s geometry (`h-14 w-14 rounded-full shadow-lg`), takes `progress`/`isRaised` props, and its `PopoverContent` opens `side="top"` with the read-progress percentage in its header. `note-editor.tsx` renders it as a sibling of `NoteOutline`, inside `<section ref={paneRef}>` but outside the header row.

**Decision:** keep the floating button. The crowding argument no longer holds — after `025` the mobile header is `← title ★ ⋯`, with visible room for a fourth icon — but the decision's other argument does: a control whose entire job is mid-read navigation belongs in thumb reach, not the top corner. That argument doesn't depend on how many other icons are in the header, so it survives on its own. Recommended, not re-litigated, by `025`'s "The outline is not in this header" section.

**Superseded:** the crowding half of "The mobile trigger is a floating action button, not a header icon" (the sentence beginning "The editor header below `md` already carries…") describes a header that no longer exists. Read that paragraph as historical justification for the decision at the time it was made, not as a current description of `note-editor.tsx`.

**Acceptance criteria:** the four FAB-specific criteria above (floating button appears below `md` and opens an upward popover; it lifts to `bottom-24` while the save bar shows; its popover header shows the read-progress percentage) are implemented and checked off. The `md`–`xl` tick-gutter criterion is unaffected and unchanged by this amendment.

### 2026-08-21 — The rail keeps its gutter; the collapsed state stops leaking letter-fragments

**What happened:** a design pass over the desktop workspace found the collapsed
rail is the worst-looking element in `/notes`, for three compounding reasons — and
that the no-headings case moves the prose.

1. **Letter-fragments.** The collapsed strip is `w-6` (24px). The row inside it
   spends `px-1.5` (12px), a `w-0.5` tick (2px), and `gap-1.5` (6px) — 20px — which
   leaves the label span 4px. `truncate` **clips** at 4px rather than hiding, so the
   collapsed gutter renders a vertical column of ~4px letter-slivers beside each
   tick. Not a subtle defect: it is legible as broken text, in the one element that
   is on screen for every long note.
2. **Mystery meat, and an orphaned toggle.** The header row (label, percentage,
   toggle) is `opacity-0` until hover or `:focus-within`, so the strip carries no
   indication of what it is. Worse, at `xl` the collapse control lives _inside_ that
   hidden header — a user who collapses the rail is left with no visible way to
   bring it back, only a 24px column of ticks they must guess is hoverable.
3. **The layout moves with the data.** `entries.length === 0 → return null`
   unmounts the whole `<aside>`. Since [`025`](./025-notes-workspace-layout.md)
   gave the prose `mx-auto max-w-[44rem]`, removing the column re-centres the note:
   switching from a note with headings to one without shifts the entire document
   sideways — 12px against a collapsed gutter, 112px against an expanded rail — and
   the pane's right border blinks out and back. That is geometry as a function of
   content, which is precisely the defect `025` exists to remove.

**Decision — the gutter is structural, and it is a margin rule.**

At `md` and up the outline column is always in flow, whatever the note contains.
Only its contents change:

| Viewport          | Note has headings | What renders                                         | Width  |
| ----------------- | ----------------- | ---------------------------------------------------- | ------ |
| ≥ `xl`, expanded  | yes               | Labelled panel — header, percentage, collapse toggle | `w-56` |
| ≥ `xl`, collapsed | yes               | Margin rule + ticks + the toggle in the head slot    | `w-6`  |
| `md`–`xl`         | yes               | Margin rule + ticks + a static `ListTree` glyph      | `w-6`  |
| ≥ `md`            | **no**            | Margin rule only                                     | `w-6`  |
| < `md`            | yes               | Floating button + popover (unchanged)                | —      |
| < `md`            | no                | Nothing (unchanged)                                  | —      |

So the prose column moves when the **user** moves it — they clicked the toggle,
and the shift is the answer to their click — and never when the data changes.

**The 24px costs nothing where it matters.** `025` capped the measure at
`max-w-[44rem]` (704px), so on any pane wider than ~728px the gutter is paid out
of slack margin and the measure is untouched. It only reaches the measure at
`md`–`lg`, where a ~400px pane becomes ~376px. That is the whole price, and it
buys a pane whose edges do not move.

**The empty gutter is a mark, not a hole.** An empty 24px column with a
`border-l` reads as a container that failed to load. Instead the collapsed rail
drops the `aside`'s `border-l` and draws a **1px full-height hairline in
`--border`, centred in the strip** — the ruled margin of a notebook page, which is
the native artifact of a second brain. Section ticks sit centred _on_ that rule,
inked to `--primary` up to and including the active section and `--border` after
it, so read-progress reads as ink rising up a margin. With no headings you see the
rule alone: deliberate, quiet, and holding the column.

This does **not** reopen "Progress is a number in the header … and **not** a
floating marker on the rail" (Design Decisions, above). Nothing is positioned on
the hairline by percentage. The ticks keep their fixed `h-7` rhythm from the
2026-08-20 amendment and the hairline is a ground behind them, not a scale — there
is no second coordinate space to drift out of.

**Three smaller calls that fall out of it:**

- **Collapsed labels are hidden, not clipped.** They stay in the DOM with their
  accessible names, and take the same `opacity-0` →
  `group-hover/outline:opacity-100` / `group-focus-within/outline:opacity-100`
  treatment the header already uses, so they fade in with the reveal instead of
  bleeding four pixels of glyph into the gutter.
- **The head slot is always occupied when there is an outline.** At `xl` it holds
  the collapse toggle at `size="icon-xs"` (`size-6` = exactly 24px, `size-3` icon),
  always visible, so "Show outline" is a target rather than a discovery. Below `xl`,
  where there is no toggle, it holds a static `aria-hidden` `ListTree` at `size-3`
  in `--muted-foreground` — enough to identify the strip as a control surface. It
  carries **no** tooltip: hovering the strip already expands it, and two things
  firing on one hover is one accessory too many.
- **The reveal panel is a surface.** The floated `w-56` panel gains `rounded-l-md`
  and `border border-border` alongside its existing `bg-popover shadow-md`, so it
  reads as a panel over the page rather than as text loose on the prose.

**Rail labels get a tooltip.** `title={entry.text}` on the row goes away in favour
of the shared `TruncatedText` treatment specced in
[`025`'s 2026-08-21 amendment](./025-notes-workspace-layout.md#2026-08-21--truncated-text-peeks-with-a-tooltip-not-a-title):
a heading clipped at ~180px is the canonical case for peeking, since the whole
point of reading the rail is deciding whether to click. The mobile popover row
loses its `title` too and gains nothing — a `title` never fires on touch. It
wraps to `line-clamp-2` instead, which is the honest fix for a device with no
pointer.

**Superseded:**

- Goal _"Cost nothing when the note has no headings, and cost no horizontal space
  when the viewport cannot spare it."_ The first clause is dropped at `md` and up:
  a note with no headings costs 24px. The clause was written when the prose could
  expand into the reclaimed width; once `025` capped the measure, "reclaiming" it
  bought nothing but a moving column. The second clause stands — below `md` the
  rail still costs nothing.
- Acceptance criterion _"Given a note with no headings, when it is opened, then no
  rail, no gutter, and no mobile outline button render, and the prose keeps the full
  pane width."_ Replaced by the two criteria below.
- Edge case _"**No headings:** nothing renders — no rail, no gutter, no floating
  button. The prose keeps the full pane width."_ Replaced by: at `md` and up the
  margin rule renders and nothing else; below `md` nothing renders, floating button
  included.

**New acceptance criteria:**

- [ ] Given a note with no headings at `md` and up, when it is opened, then the
      outline column still occupies `w-6`, renders the margin rule and no ticks, no
      glyph, and no toggle.
- [ ] Given two notes that both have headings, when the user switches between them
      at any width from `md` up — including while the rail is collapsed, expanded,
      or in the `md`–`xl` gutter — then the prose column does not move horizontally
      and the pane's right edge does not change.
- [ ] Given a note with headings and one without, when the user switches between
      them, then the column never unmounts — it settles at `w-6` rather than
      disappearing. **Accepted discontinuity:** if the rail was expanded (`w-56`)
      by user preference on the first note, opening the headless note still
      collapses it to the gutter, since there is nothing to expand into. This
      narrows the old defect (a full 56px-to-0 disappearance) to a single
      56-to-6 settle, and only in the one combination where the user's own
      preference and the note's content actively disagree.
- [ ] Given the collapsed gutter, when it is not hovered or focused, then no
      fragment of any heading label is visible inside the 24px strip.
- [ ] Given the rail collapsed by the toggle at `xl`, when the pointer is nowhere
      near it, then the expand control is still visible in the gutter's head slot.
- [ ] Given a viewport between `md` and `xl`, when the note has headings, then the
      head slot shows a static outline glyph and no tooltip opens on hovering it.
- [ ] Given the reader scrolls a long note with the rail collapsed, then the ticks
      up to and including the active section are `--primary` and the rest are
      `--border`, against the hairline.

**Implementation:** `note-outline.tsx` only. The `isMobile || entries.length === 0`
early return splits: below `md` it still returns `null`; at `md` and up an empty
`entries` renders the `aside` with the rule and no `nav` children. The collapsed
branch drops `border-l` on the `aside` and adds the hairline as an `aria-hidden`
absolutely-positioned `w-px inset-y-0 left-1/2 bg-border` child. `OutlineRow`'s
label span takes the collapsed opacity classes, and its `title` is replaced by
`TruncatedText`. `NoteOutlineMobileMenu`'s row drops `title` and swaps `truncate`
for `line-clamp-2`.

**Manual verification:**

- [ ] Collapse the rail at `xl`; confirm the expand control is visible without
      hovering, and that no letter-slivers appear beside the ticks.
- [ ] Click between a heading-rich note and a heading-free one; confirm the prose
      does not shift by a pixel.
- [ ] Open a note with no headings at `md`, `lg`, and `xl`; confirm the margin rule
      reads as intentional in both themes and not as an empty container.
- [ ] Hover the collapsed gutter at `lg`; confirm the panel floats with a visible
      border and lands on margin, not on prose.

### 2026-10-04 — H4 is now a distinct outline level (see spec 030)

The non-goal _"No new heading levels. H4–H6 remain absent from the slash menu"_ and the depth rule _"H3 (and clamped H4–H6) a half-width one"_ are superseded by [030 — First-Class Heading 4](./030-notes-heading-4-support.md). `OutlineEntry.level` widens to `1 | 2 | 3 | 4`; H4 gets its own indent and tick, and H5–H6 clamp to 4 instead of 3. The derived-from-JSON design and `domIndex` alignment are unchanged.
