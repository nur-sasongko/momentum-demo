---
id: 25
title: 'Second Brain Workspace Layout: Chrome That Does Not Grow'
status: in-progress
feature: notes
created: 2026-08-21
updated: 2026-08-21
---

# Second Brain Workspace Layout: Chrome That Does Not Grow

## Problem Statement

Every container in the `/notes` workspace is sized by the data it holds, so the
workspace gets worse the more the library is used. The list pane renders the
**entire tag vocabulary** as wrapped chips (`note-list.tsx:184-211`) — thirty
tags is five rows and roughly 160px of header, on top of a title row, a search
row, and a controls row, for a four-row header that pushes the actual notes below
the fold. The detail-pane header (`note-editor.tsx:308`) is a `flex-wrap` row
with an unbounded `TagInput` on the left and a six-button cluster on the right,
so adding tags wraps the action cluster onto a second line, and at 360px the six
buttons leave the tag editor about 140px to live in. The list row
(`note-list-item.tsx:54-62`) has the same unbounded wrap a third time, so row
height varies note to note and the list scans as a ragged column instead of a
rhythm. None of this is a styling problem: the header height is a function of how
many tags the user has created, which means the UI degrades as a reward for using
it.

## Goals

- **Chrome gets a fixed height; data gets the scroll.** No bar, header, or row in
  `/notes` may change height as a function of tag count, note count, or title
  length.
- Bound the list-pane header to at most two rows at any tag count, down from
  today's four-and-growing.
- Bound the detail-pane header to exactly one row at every viewport width, with
  at most three controls on mobile, down from today's eight items.
- Move a note's tags out of the toolbar and into the note's own metadata, where
  they read as attributes of the document rather than as verbs.
- Give the prose a readable measure instead of the full pane width.
- Retire the second tag UI: one tag picker serves both filtering and note
  tagging.
- Bring the note list onto the surface-ladder rules from
  [`020`](./020-core-design-system-refresh.md) — the list is a navigation rail and
  currently violates the documented "no brand wash on a field" rule.

## Non-Goals

- **No data model changes.** `tags` stays a `text[]` on the note row; no tag
  entity, no join table, no colors on tags, no tag hierarchy or nesting.
- **No query changes.** `get_note_tags()`, `useNotesListQuery`, and the
  `AND`/`OR`/`untagged` filter semantics are untouched. This spec only changes
  which control writes those params.
- **No editor-internals changes.** The Tiptap extension stack, bubble menus,
  slash commands, `[[` links, tables, and code blocks are out of scope.
- **No change to the save model.** Explicit save ([`017`](./017-notes-editor-explicit-save.md))
  and the `UnsavedChangesBar` stay exactly as they are, including the pane-blur
  flush contract.
- **No change to the outline's behavior** ([`024`](./024-notes-table-of-contents.md)).
  Its three responsive states, its placement inside `<section ref={paneRef}>`, and
  its mobile floating trigger are constraints this spec must respect, not revisit.
  Below `md` the outline is **not** a header control — see "The outline is not in
  this header" below.
- **No global search / command palette.** Considered and deferred — see Open
  Questions.
- **Not fixing the `tasks` route**, which carries the same hardcoded viewport-height
  bug. Noted in Implementation Notes as a follow-up.

## Design Decisions

### The diagnosis: chrome sized by data

The three complaints in the problem statement are one defect with three sites.
Wherever this UI needs to show a set whose size the user controls, it renders the
whole set inline, in a `flex-wrap` container, inside chrome. That is a layout
that cannot be tuned — it can only be re-architected, because no amount of
spacing work fixes a container whose height is `O(n)` in the user's tag count.

The rule this spec adopts, and which every decision below follows from:

> **Chrome has a declared height. Only content scrolls.**

Applied: the list header is one row plus an optional one-line filter summary. The
detail header is one row. The list row is a fixed height. The set that the user
controls — the tag vocabulary — moves behind a trigger into a popover with its
own scroll, which is the only container in the design that is allowed to grow.

### Filters: show the selection, not the vocabulary

Rendering all tags is a filter control whose surface scales linearly with the
data it filters — the only one in the app that does. The tag chip row is replaced
by a single trigger button plus a summary of what is currently active:

- **Always exactly one row:** search input, a filter trigger, and new-note.
- **Zero or one more row:** the active filters, only when filters are set.

The vocabulary moves into the trigger's popover, searchable and scrollable. Sort,
favourites-only, untagged-only, and the match mode go in there too — they are all
"how am I looking at the library", they are all currently competing for space in
the third header row, and none of them is frequent enough to hold a permanent
slot next to the search field.

**`get_note_tags()` already returns `noteCount` per tag, and the current chip row
throws it away** (`note-list.tsx:199` destructures `{ tag }`). The picker spends
it: each row carries its count, right-aligned, in `.tabular`. See "The one
composed element" below.

### The detail header: sort the nouns from the verbs

Auditing what currently sits in the detail header — back, tags, read-only badge,
outline, undo, redo, favourite, lock, archive — two things do not belong:

**Undo and redo are text-editing operations, not document operations.** They are
in the same category as bold, italic, and heading level, and every other
formatting affordance in this app already lives in a bubble menu or the `/`
palette rather than in document chrome. They are also the two widest items in the
cluster, and `⌘Z` / `⇧⌘Z` already work without them. They move into the overflow
menu, with their shortcuts shown, so they stay discoverable without holding a
permanent slot.

**Tags are an attribute of the note, like its title and its edit time — not a
verb.** They are the only noun in a row of verbs, they are the only item whose
width is unbounded, and they are what wraps the cluster. They move into the
content column, directly under the title, which is both where the user proposed
putting them and where the list rows already render tags. This is the change that
makes the header a fixed height: with tags gone, nothing left in the bar has a
data-dependent width.

What remains earns its slot: back (mobile only), the note title (revealed on
scroll — see below), the read-only badge, favourite, and an overflow menu. Mobile
shows three controls; desktop shows two.

### The outline is not in this header

[`024`](./024-notes-table-of-contents.md) moved the mobile outline trigger out of
this header and onto a floating action button at `bottom-6 right-6`, matching
`task-add-fab.tsx`. That decision predates this spec's header, so its stated
reason — that a sixth icon would wrap the row or steal width from the tag input —
no longer applies: after this spec there is no tag input, and the header has room
for a fourth icon.

**The decision still stands, on its other argument.** `024` also says the header
is "the least reachable spot for a one-handed grip, for a control whose entire job
is mid-read navigation." That argument is about reachability, not crowding, and it
survives this spec intact — arguably it was always the stronger of the two. The
outline is the one control here you reach for _while reading_, and it is the one
control that should not be in the top corner.

So the header stays at three controls on mobile and does not reclaim the slot. The
consequences this spec must carry:

- The floating button is a sibling of `NoteOutline` inside `<section ref={paneRef}>`
  (`024` implementation step 7), so this spec's header work must not pull it into
  the header row.
- The button lifts to `bottom-24` while `UnsavedChangesBar` shows. This spec does
  not change that bar, so the coupling is unaffected.
- The list pane's fixed footer (below) and the floating button are never on screen
  together — below `md` the two panes are mutually exclusive via `mobileView`.
- `useIsMobile` returning `false` on first render is more visible with a floating
  button than it was with a header icon: a 56px circle pops into the bottom-right
  corner after first paint. See Edge Cases.

### The header's new job: the title on scroll

With tags gone, the desktop header would be an empty bar with two icons pinned
right. Rather than shrink it away, it gets a real job: once the note's `<h1>`
scrolls out of view, the header shows the note title. Deep in a long note you
keep your bearings, and on mobile the bar now carries the single most useful
string instead of a jumble of chips. The title truncates to one line, so the bar
stays fixed-height by construction.

### Tags on the note: text, not chips

Tags in the note byline render as hash-prefixed text — `#spec #notes #q3` — not
as filled pills.

This is not a new invention. `note-list-item.tsx:57` already renders tags exactly
this way, and it is the one place in the notes UI where the tag row does not look
broken. The pill treatment exists only in `TagInput`, which is the component
being retired.

It is also the change that makes the growth bug impossible rather than merely
managed. A run of text has no border, no padding, no fixed height, and no minimum
width; it wraps and truncates like the prose it sits above. You cannot have a
chip-row overflow problem in a design that has no chips. And a pill implies a
button affordance that is wrong here — on a note, the tags are metadata you read,
not the primary thing you act on.

Each `#tag` is still interactive: clicking one adds it to the list filter without
leaving the note, which is the move a knowledge base is for — _show me everything
else like this_. Editing tags happens through a `＋` at the end of the run, which
opens the same picker the filter trigger uses.

### One tag picker, two call sites

`TagInput` (177 lines) and the filter chip row are two different UIs over the same
tag vocabulary, and both are the wrong shape: one is an inline wrapping input
crammed into a toolbar, the other is an unbounded chip cloud. Both are replaced by
a single `TagPicker` — a searchable, scrollable, checkbox list with counts —
mounted in a `Popover` at two call sites:

| Call site        | `allowCreate` | Footer                                            |
| ---------------- | ------------- | ------------------------------------------------- |
| List filter      | `false`       | match mode, favourites, untagged, sort, clear all |
| Note byline `＋` | `true`        | none                                              |

`tag-input.tsx` is deleted. On mobile this is a strict upgrade: tag editing becomes
a popover with its own scroll and its own search, instead of a 140px input wedged
between a back button and six icons.

### The list pane is a navigation rail, so it uses the rail's tokens

`note-list-item.tsx:26` paints the selected row `bg-primary/10` — a violet wash
over a field, on a warm-paper surface. That is precisely the decal defect that
[`020`](./020-core-design-system-refresh.md#interaction-states-are-made-of-the-field-not-painted-onto-it)
diagnosed in the sidebar and wrote a rule against: _a state is a step in the
surface ladder, not a hue; brand belongs in the foreground._ Hover is
`bg-muted/50`, which is close enough to the pane's own `bg-card/30` that hover and
selected are hard to tell apart — the second documented failure, hover and selected
sharing a value.

The fix needs no new tokens, because the right ones already exist and are already
validated. The note list _is_ a navigation rail — a persistent, scrollable index
you pick a destination from — so it adopts the rail's material:

| Role     | Token                                                       |
| -------- | ----------------------------------------------------------- |
| Field    | `--sidebar` (replaces `bg-card/30`)                         |
| Hover    | `--sidebar-accent`                                          |
| Selected | `--sidebar-active` + `--sidebar-active-foreground` on title |
| Hairline | `--sidebar-border`, light mode only, with `shadow-xs`       |

Rows become `mx-2 rounded-md` chips like `SidebarMenuButton`, so "selected"
reads as a chip rising out of the field rather than a full-bleed colour band, and
the two rails in the app read as the same material.

The per-row `border-b` (`note-list-item.tsx:25`) goes away with it. Thirty notes
is currently thirty hairlines stacked into a ladder, on top of the pane border and
two header borders. Rows separate by whitespace and by the hover step instead —
quiet until pointed at. This is the accessory the design removes.

### The prose gets a measure

The content column is `px-6 py-5` with no maximum width, and
`tiptap-editor.tsx:58` explicitly sets `max-w-none`, overriding Tailwind
Typography's default `65ch`. On a 27" display with the list pane at 320px and the
outline collapsed, a note is roughly 1200px of 16px text — around 170 characters
per line, more than double a comfortable measure. This is the largest single
legibility problem in the workspace and it is one class to fix.

The title, byline, and editor body get a shared `max-w-[44rem] mx-auto` wrapper
(~75 characters at the base Inter size; Notion's is 708px for comparison).
`max-w-none` stays on the ProseMirror node itself so tables and code blocks can
still fill the column.

Two bonuses fall out. Centring the column leaves slack margin on the right, which
is where `024`'s collapsed outline gutter expands on hover — so at `md`–`xl` the
reveal stops covering prose. And the byline's tag run now wraps inside a 704px
column instead of a 1200px one, which is what makes text-tags legible as a group.

### The one composed element

Everything above subtracts: chips, borders, buttons, a whole component. One
element is added, and it is the answer to the question the brief asked — _should
tags move under Last Edited?_

The **note byline** is the note's identity line, and it is the only place in this
layout that spends the design system's two-voice typography deliberately:

```
Edited 2h ago · 412 words                              Unsaved changes
#spec  #notes  #q3   ＋
```

Words in Inter, every quantity in IBM Plex Mono via `.tabular` — the relative
time, the word count — and the tags in `--primary` as hash-prefixed text. It is
the library-catalog register the rest of the design stays quiet for: what this
note is, how big it is, when it was touched, what it is filed under, in one
readout.

The same voice carries into the picker, which is the byline's counterpart for the
whole library — a right-aligned `.tabular` count column turning the tag vocabulary
into an index of what is actually in there:

```
⌕ Find a tag…
────────────────────────────
☑ spec                    12
☐ q3                       8
☐ reading                  5
```

The design system already mandates `.tabular` on "tag counts in
`tag-manager-dialog.tsx`", so this is that rule applied to the place tags are
actually chosen, not a new flourish.

**Word count is new.** It is cheap — `noteContentToPlainText` already exists — and
it recomputes on exactly the cadence the outline already uses (`handleEditorBlur`
and on save), never per keystroke, for the same reason `024` gives: recomputing on
every character makes the line reflow as you type.

### Copy

The filter popover speaks the user's language, not the query's:

| Today                | Becomes                                  |
| -------------------- | ---------------------------------------- |
| `OR` / `AND` toggle  | `Match: Any` / `All`                     |
| `All` chip           | (gone — "no filters" is the empty state) |
| `Untagged` chip      | `Untagged only` checkbox                 |
| `Last edited 2h ago` | `Edited 2h ago`                          |
| `Search notes...`    | `Search notes…`                          |

`AND`/`OR` is SQL leaking into the interface. "Match any of these tags" / "Match
all of these tags" is what the person is choosing. The `All` chip disappears
because "no filter applied" is a state, not a button — the active-filter row is
simply absent, and `Clear all` is how you get back there.

**`Last edited 2h ago` also fixes a real bug.** `formatTimeSince` can return
`"just now"`, and the current JSX appends a literal `ago`
(`note-editor.tsx:424-429`), so a freshly saved note reads **"Last edited just now
ago"**. The byline uses a new `formatTimeAgo` that owns the whole phrase.

### The save indicator stops moving the byline

`saveIndicator` is currently concatenated into the byline string, so the metadata
line reflows between `""`, `" · Saving…"`, `" · Saved"`, and `" · Unsaved
changes"` while you work — and it duplicates the `UnsavedChangesBar`, which is
purpose-built for exactly this. It moves to a right-aligned slot on the byline's
first row, so the metadata on the left never shifts.

## Acceptance Criteria

**Bounded chrome**

- [x] Given a library with 50 distinct tags, when `/notes` renders, then the list
      pane header is exactly one row (search + filter + new note) and no taller
      than with 0 tags. (True by construction: the header row's three children
      never read tag data — the vocabulary lives inside `NotesFilterPopover`'s
      portal content, not the header's own layout flow.)
- [x] Given 5 active tag filters, then the active-filter row is a single line: the
      first 3 tokens, a `+2` overflow affordance, and `Clear all`.
      (`VISIBLE_ACTIVE_FILTERS = 3` in `note-list.tsx`; `overflowCount = tokens.length - visibleTokens.length`.)
- [x] Given no active filters, then no active-filter row renders at all.
      (`{tokens.length > 0 ? (...) : null}`.)
- [x] Given a note with 12 tags at a 360px viewport, then the detail-pane header is
      one row of fixed height and the action cluster does not wrap. (The header
      JSX renders no tag data at all — tags moved to the byline — so nothing in
      it has a data-dependent width.)
- [x] Given a note with 12 tags, then the list row for it is the same height as the
      row for a note with 0 tags. (`note-list-item.tsx`'s tag line is
      `line-clamp-1`, fixed to one line regardless of tag count.)
- [x] No `flex-wrap` remains in `note-list.tsx`, `note-editor.tsx`, or
      `note-list-item.tsx` — confirmed via
      `grep -n "flex-wrap" src/routes/_authenticated/notes/-components/note-{list,editor,list-item}.tsx`
      (0 matches).

**Detail header**

- [x] Given a mobile viewport, then the detail header shows at most three controls:
      back, favourite, overflow — and **no** outline trigger, which lives on the
      floating button per [`024`](./024-notes-table-of-contents.md).
- [x] Given a desktop viewport, then the detail header shows favourite and overflow
      only, and no back button. (`onBack` is only ever passed from `index.tsx`
      when `isMobile`.)
- [x] `grep -n "NoteOutlineMobileMenu\|ListTree" src/routes/_authenticated/notes/-components/note-editor.tsx`
      shows no occurrence inside the header row's JSX. (Both hits are inside the
      `flex min-h-0 flex-1` scroll+rail wrapper, a sibling of the header, not
      inside it.)
- [x] The overflow menu contains Undo, Redo, Lock/Unlock, and Move to Archive, with
      `⌘Z` / `⇧⌘Z` shown as shortcut hints, and Undo/Redo disabled exactly when
      `canUndo` / `canRedo` are false.
- [ ] Given the note body is scrolled so the `<h1>` is out of view, then the header
      shows the note title truncated to one line; given the `<h1>` is visible, the
      header title is hidden. (Implemented via an `IntersectionObserver` on the
      title input, rooted at the scroll container; not yet confirmed in a running
      browser.)
- [x] Given a read-only note, then the `Read-only` badge is visible in the header
      and the byline's `＋` add-tag trigger is absent.

**Tags**

- [x] Given a note, then its tags render under the title as `#tag` text in
      `--primary`, with no border, background, or fixed height.
- [x] Given a note tag is clicked, then that tag is added to the list's active tag
      filter and the note stays open. (`toggleActiveTag` only ever writes the
      `tags` search param — it never touches `note`/`selectedId`.)
- [x] Given the byline `＋` is clicked, then a `TagPicker` popover opens with the
      note's current tags checked, a search field, and a `Create "…"` row when the
      query matches no existing tag.
- [x] Given a tag is toggled in the byline picker, then `useUpdateNoteMetaMutation`
      fires immediately (unchanged from today) and the byline updates.
- [x] `src/routes/_authenticated/notes/-components/tag-input.tsx` no longer exists
      and nothing imports `TagInput`. (Confirmed: file deleted,
      `grep -rn "TagInput" src` returns 0 matches.)

**Filter popover**

- [x] Every tag row shows its `noteCount`, right-aligned, carrying `.tabular`.
- [ ] Given the tag search field has text, then only matching tags are listed, and
      the list is scrollable with a bounded max height. (Implemented with
      `max-h-64 overflow-y-auto` plus a case-insensitive substring filter; not
      yet confirmed in a running browser.)
- [x] Given 2 or more tags are selected, then a `Match: Any / All` control is
      visible; given fewer than 2, it is absent.
      (`showMatchMode = activeTags.length >= 2`.)
- [x] Given `Untagged only` is checked, then the tag list is disabled and any
      selected tags are cleared in a single navigation (per
      [`016`](./016-notes-filters-url-state.md)); given a tag is then selected,
      `Untagged only` clears. (The mutual-exclusion logic already lived in
      `use-notes-filters.ts`'s `setUntaggedOnly`/`toggleActiveTag`, unchanged by
      this spec; `TagPicker`'s new `disabled` prop visually disables the list
      while `Untagged only` is on.)
- [x] The filter trigger carries a count badge equal to
      `tags.length + (fav ? 1 : 0) + (untagged ? 1 : 0)`; sort does not count.
- [x] Every control in the popover writes the same URL search params as today —
      `q`, `tags`, `tagMode`, `untagged`, `fav`, `sort` — with no schema change.
      (`NotesFilterPopover` calls only `useNotesFilters()`/`useNoteTagsQuery()`;
      `notes-route-search.ts` is untouched.)

**Surfaces**

- [x] The list pane field is `--sidebar`; hover is `--sidebar-accent`; selected is
      `--sidebar-active` with `--sidebar-active-foreground` on the title.
- [ ] Given one row is selected and a different row is hovered, both states are
      simultaneously legible and distinct. (Classes mirror
      `sidebarMenuButtonVariants`' own selected/hover split; not yet confirmed in
      a running browser in both themes.)
- [x] **Restated** (see 020's own precedent for a literal grep false-positive): a
      blind `grep -n "bg-primary/10\|bg-card/30" src/routes/_authenticated/notes/-components/`
      now matches `notes-empty-state.tsx:26` — an unrelated decorative icon-badge
      background, not a row-selection wash. Scoped to the row files instead,
      `grep -n "bg-primary/10\|bg-card/30" src/routes/_authenticated/notes/-components/note-list.tsx src/routes/_authenticated/notes/-components/note-list-item.tsx`
      returns 0 matches.
- [x] No `border-b` on individual list rows.

**Measure and height**

- [x] The title, byline, and editor body share one `max-w-[44rem] mx-auto`
      container. (`note-editor.tsx`'s scroll pane wraps all three in
      `<div className="mx-auto w-full max-w-[44rem]">`.) Whether prose lines stay
      under ~75 characters at every viewport width is not yet confirmed visually.
- [x] Tables and code blocks still fill the full width of that container.
      (`tiptap-editor.tsx`'s `max-w-none` on the ProseMirror node is untouched —
      the cap moved to the new wrapper `div`, one level up.)
- [x] Given a `sm`-and-up viewport, then the notes workspace bottom edge aligns
      with the viewport bottom with no clipping and no page-level scrollbar — the
      hardcoded `3.5rem` no longer disagrees with `--topbar-height` at `sm`+.
      (`--topbar-height` is now `3.5rem` at base, `3rem` at `sm`+ via a media
      query in `styles.css`; `TopBar.tsx` reads it unconditionally; the three
      `notes/index.tsx` heights read `var(--topbar-height)` instead of a literal
      `3.5rem`.) Not yet confirmed pixel-exact in a running browser.
- [x] Given mobile Safari with browser chrome hiding on scroll, the two-pane height
      does not jump (`svh`, not `dvh`). (All three occurrences in `notes/index.tsx`
      now read `100svh`.)

**Copy**

- [x] The byline reads `Edited just now` for a note saved seconds ago — never
      `Edited just now ago`. (`formatTimeAgo` returns `formatTimeSince`'s value
      unchanged when it's exactly `'just now'`, and appends `' ago'` otherwise.)
- [x] The match control reads `Any` / `All`, not `OR` / `AND`.
- [x] The save status renders in a right-aligned slot and never shifts the byline's
      metadata text. (`NoteByline` renders the metadata `<p>` and the status
      `<span>` as separate flex children — the status never concatenates into the
      metadata string.)

## Data Model Changes

**Store:** none. `src/stores/notes-store.ts` keeps `linkTargets` and
`isOutlineCollapsed` exactly as they are. No `version` bump, no `migrate`.

**Route search params:** none. `notesSearchSchema` is unchanged — this spec
rebuilds the controls that write `q` / `tags` / `tagMode` / `untagged` / `fav` /
`sort`, not the params themselves.

**Types:** one addition, in `-types/notes-outline.ts`'s sibling position:

```ts
// src/routes/_authenticated/notes/-types/notes-tags.ts
export interface TagPickerProps {
  selected: string[]
  counts: NoteTagCount[]
  onToggle: (tag: string) => void
  allowCreate?: boolean
  onCreate?: (tag: string) => void
  footer?: React.ReactNode
}
```

## UI / UX Notes

### Desktop, ≥1280px

```
┌──────────────── TopBar · Momentum / Second Brain ──────────────────────────┐
├─ NoteList w-80 ─────────┬─ NoteEditor ──────────────────┬─ Outline w-56 ───┤
│ ⌕ Search notes…   ⚟² ＋ │                        ★  ⋯   │ ON THIS PAGE 42% │
│ #spec × #q3 ×  Clear all│   ┌──── max-w-[44rem] ────┐   │ ▬ Intro          │
│─────────────────────────│   │ Supabase RLS          │   │ ▬ Policies       │
│ ╭─────────────────────╮ │   │ Edited 2h ago · 412   │   │ ▹ Insert         │
│ │ Supabase RLS    2h  │ │   │   words        Saved  │   │ ▬ Testing        │
│ │ Row-level security… │ │   │ #spec #q3  ＋         │   │                  │
│ │ #spec #q3           │ │   │ ───────────────────── │   │                  │
│ ╰─────────────────────╯ │   │ Row-level security is │   │                  │
│   Tag system rework 1d  │   │ enabled per table…    │   │                  │
│   Rewriting the filter… │   │                       │   │                  │
│   #spec #ui             │   └───────────────────────┘   │                  │
│─────────────────────────│                               │                  │
│ ⧉ Archive 3      ⚙ Tags │                               │                  │
└─────────────────────────┴───────────────────────────────┴──────────────────┘
```

`⚟²` is the filter trigger with its active-count badge. The selected row is the
risen chip; every other row is flat on the field until hovered.

### Mobile — list

```
┌──────────────────────────┐
│ ⌕ Search notes…   ⚟¹  ＋ │  ← one row, fixed
│ #spec ×  +2     Clear all│  ← only when filters set
├──────────────────────────┤
│ ╭──────────────────────╮ │
│ │ Supabase RLS     2h  │ │
│ │ Row-level security…  │ │
│ │ #spec #q3            │ │
│ ╰──────────────────────╯ │
│   Tag system rework  1d  │
│   …                      │
├──────────────────────────┤
│ ⧉ Archive 3       ⚙ Tags │  ← fixed footer, thumb-reachable
└──────────────────────────┘
```

### Mobile — note

```
┌──────────────────────────┐
│ ←  Supabase RLS    ★  ⋯  │  ← title fades in on scroll
├──────────────────────────┤
│ Supabase RLS             │
│ Edited 2h ago · 412 words│
│ #spec #q3  ＋            │
│ ──────────────────────── │
│ Row-level security is…   │
│ enabled per table, and   │
│ every policy needs…      │
│                          │
│                    ╭───╮ │
│                    │ ☰ │ │  ← outline FAB, owned by 024
│                    ╰───╯ │
└──────────────────────────┘
```

Three controls in the bar, down from eight items. Tag editing is `＋` → popover.
The outline button is not part of this header — it belongs to
[`024`](./024-notes-table-of-contents.md) and lifts to `bottom-24` while the save
bar shows.

### The filter popover

```
┌─ ⚟ ──────────────────────────────┐
│ ⌕ Find a tag…                    │
│ ────────────────────────────────  │
│ ☑ spec                       12  │   scrollable, max-h-64
│ ☐ q3                          8  │   count right-aligned, .tabular
│ ☐ reading                     5  │
│ ☐ archive                     2  │
│ ────────────────────────────────  │
│ Match          [ Any ][ All ]    │   only when ≥2 selected
│ ────────────────────────────────  │
│ ☐ Favourites only                │
│ ☐ Untagged only                  │
│ ────────────────────────────────  │
│ Sort        Last updated      ▾  │
│ ────────────────────────────────  │
│ Clear all                        │
└──────────────────────────────────┘
```

The byline picker is the same list with `allowCreate` and no footer.

### Why the pane footer

`Archive` and `Manage tags` are destinations, not filters, so burying them inside
a filter popover would be wrong, and keeping them as header icons is what forced
the four-row header in the first place. A fixed `h-9` footer costs one row that
can never grow, sits below the scroll region where it does not compete with
scanning, and on mobile — where the list pane is full-screen — puts both doors in
thumb reach rather than in the top-right corner. Icons carry labels because there
is room for them.

### Active-filter overflow

Overflow is resolved by a fixed count, not by measurement — `VISIBLE_ACTIVE_FILTERS
= 3`, each token `max-w-32 truncate`, then `+N`, then `Clear all` pushed right.
Measuring text to decide how many chips fit is fragile at every zoom level and
font-swap; a constant is deterministic and the `+N` opens the popover where the
full selection is visible anyway.

### Interaction inventory, before and after

| Control          | Today                         | After                            |
| ---------------- | ----------------------------- | -------------------------------- |
| Search           | list header row 2             | list header row 1                |
| Tag filter       | header row 3, unbounded chips | filter popover                   |
| Match `AND`/`OR` | header row 4                  | filter popover                   |
| Favourites only  | header row 4                  | filter popover                   |
| Untagged         | header row 3, as a chip       | filter popover                   |
| Sort             | header row 4                  | filter popover                   |
| Manage tags      | header row 4                  | pane footer                      |
| Archive          | header row 1                  | pane footer                      |
| New note         | header row 1                  | list header row 1                |
| Note tags        | detail header, `TagInput`     | note byline, `#tag` + `＋`       |
| Undo / Redo      | detail header                 | overflow menu (+ `⌘Z`)           |
| Lock / Unlock    | detail header                 | overflow menu                    |
| Archive note     | detail header                 | overflow menu                    |
| Favourite        | detail header                 | detail header (kept)             |
| Outline          | detail header (mobile)        | floating button (owned by `024`) |
| Note title       | —                             | detail header, on scroll         |
| Word count       | —                             | note byline                      |

## Edge Cases

- **Zero tags in the library.** The filter trigger still renders (search-by-text
  and sort still live in there) but the popover's tag list shows `No tags yet`.
  The byline shows only `＋ Add tag`.
- **One very long tag** (60 characters). In the byline it wraps as text. In the
  active-filter row it truncates at `max-w-32` with the full value in `title`. In
  the picker it truncates with the count column holding its right edge.
- **Duplicate-cased tags.** `canonicalizeTag` already snaps new input to existing
  casing and `get_note_tags()` groups on `lower(t)`. The picker's `Create "…"` row
  must not appear when the query case-insensitively matches an existing tag.
- **Read-only note.** No `＋` in the byline; tags render as plain text; the
  overflow menu shows `Unlock note` and disables Undo/Redo.
- **Empty note.** Byline reads `Edited just now · 0 words`.
- **Word count and the save contract.** Word count is derived from
  `draft.content` on blur and on save, never per keystroke — the same cadence
  `024` established for the outline, and for the same reason.
- **The pane-blur flush.** The byline picker and the overflow menu are Radix
  portals rendering outside `<section ref={paneRef}>`. Both **must** carry
  `data-note-editor-portal` or `handlePaneBlur` will read opening them as
  "left the pane" and fire a save (`note-editor.tsx:66-74`). This is the same trap
  `024` documented for the outline rail.
- **Scroll container padding.** `024` notes that `pb-20` (added when the save bar
  shows) changes `scrollHeight` and that a `ResizeObserver` re-measures. Adding
  `max-w-[44rem] mx-auto` changes the container's width, not its scroll height —
  but the outline's scroll-spy must be re-verified after the change, not assumed.
- **Title-on-scroll and the outline.** Both watch the same scroll container. Use a
  single `IntersectionObserver` on the title input rather than a scroll listener,
  so the header reveal costs nothing per frame.
- **`useIsMobile` returns `false` on first render** (state starts `undefined`), so
  on a phone the first paint renders _both_ panes and then corrects — a visible
  flash, and `NoteEditor` mounts and unmounts for nothing. Since there is no SSR
  ([`004`](./004-core-remove-ssr.md)), the hook can initialise synchronously from
  `matchMedia`. See Implementation Notes for the scope caveat. **This got more
  visible with `024`'s floating outline button**: a 56px filled circle appearing in
  the bottom-right corner one frame late reads as a glitch in a way a 28px header
  icon did not.
- **Footer and floating button never collide.** The list pane's fixed footer is
  bottom-anchored in the list pane; `024`'s outline button is bottom-anchored in
  the viewport over the note pane. Below `md` the two panes are mutually exclusive
  (`mobileView` in `index.tsx`), so they are never on screen together. At `md` and
  up the outline is a rail or a gutter and there is no floating button at all.
  Verify this holds if the mobile view model ever changes to show both panes.
- **Browser back on mobile.** `mobileView` is component-local, so back from a note
  leaves `/notes` entirely instead of returning to the list, and a reload always
  lands on the list. Not fixed here — see Open Questions.
- **Persistence boundary.** Every filter is already in the URL
  ([`016`](./016-notes-filters-url-state.md)), so a reload restores the filter
  state and the active-filter row rebuilds from it. Nothing new persists.

## Implementation Notes

Rough order — shared picker first, then each pane, then the surface pass.

1. **`-types/notes-tags.ts`** — `TagPickerProps`.
2. **`-components/tag-picker.tsx`** (new) — search field, scrollable
   `NoteTagCount` list with `Checkbox` + right-aligned `.tabular` count,
   optional `Create "…"` row, optional `footer` slot. No popover of its own; call
   sites wrap it.
3. **`-components/notes-filter-popover.tsx`** (new) — `Popover` + trigger with
   count badge, `TagPicker` + the footer (match mode, favourites, untagged, sort,
   clear all). Reads and writes exclusively through `useNotesFilters`.
4. **`-components/note-list.tsx`** — collapse four header rows to one plus the
   conditional active-filter row; delete `chipClass`, the tag chip map, the
   `showAndOr` group, the favourites button, and the sort `Select`; add the fixed
   footer with Archive + Tags; field to `bg-sidebar`.
5. **`-components/note-list-item.tsx`** — drop `border-b`; `mx-2 rounded-md`;
   hover/selected onto `--sidebar-accent` / `--sidebar-active` with
   `--sidebar-active-foreground` on the title; clamp the tag run to one line.
6. **`src/utils/date.ts`** — add `formatTimeAgo(iso)` returning the complete
   phrase (`just now`, `2h ago`). Leave `formatTimeSince` alone; the list column
   wants the bare duration.
7. **`-utils/notes-utils.ts`** — add `countWords(plainText)`.
8. **`-components/note-byline.tsx`** (new) — the two-row byline: metadata + save
   slot, then the `#tag` run + `＋` picker.
9. **`-components/note-editor.tsx`** — header down to one fixed row (back, title
   on scroll, read-only badge, favourite, overflow); move Undo / Redo / Lock /
   Archive into a `DropdownMenu`; remove `TagInput`; wrap title + byline + editor
   in `max-w-[44rem] mx-auto`; move `saveIndicator` into the byline's right slot;
   add the title `IntersectionObserver`.
   **Keep `NoteOutline` and the outline floating button inside
   `<section ref={paneRef}>`**, both as siblings of the scroll region and neither
   inside the header row ([`024`](./024-notes-table-of-contents.md) steps 5 and 7).
   Add `data-note-editor-portal` to the new dropdown and popover content.
   `024` already sets it on the outline popover.
10. **Delete `-components/tag-input.tsx`.**
11. **`src/styles.css`** — make `--topbar-height` responsive (`3.5rem` base,
    `3rem` at `sm`) so there is one source of truth for the bar height.
12. **`src/components/TopBar.tsx`** — `h-(--topbar-height)` unconditionally,
    dropping the `h-14 sm:h-(--topbar-height)` pair.
13. **`-components/../notes/index.tsx`** — replace all three
    `h-[calc(100dvh-3.5rem)]` with `h-[calc(100svh-var(--topbar-height))]`
    (`svh`, not `dvh` — a two-pane layout must not resize as mobile browser chrome
    hides).
14. **`docs/second-brain.md`** — update "Current UX at `/notes`" and the component
    list once shipped.
15. **`CHANGELOG.md`** — `Changed` entry under `## [Unreleased]`.

**Scope caveats, deliberately left out of the steps above:**

- `src/hooks/use-mobile.ts` initialising synchronously would fix the first-paint
  flash, but it is a shared hook used by `archived-notes-sheet`, `note-outline`,
  `sidebar`, and the tasks route. One line, app-wide blast radius — better as its
  own `core` change than smuggled into a notes layout spec.
- `src/routes/_authenticated/tasks/index.tsx` has the same
  `h-[calc(100dvh-3.5rem)]` in four places and inherits the same off-by-8px bug at
  `sm`+. Steps 11–12 fix the token it should be reading; migrating the tasks route
  to it is follow-up.

## Test Plan

**Unit tests** (`src/routes/_authenticated/notes/-utils/__test__/`, `src/utils/__test__/`):

- [ ] `formatTimeAgo` returns `just now` under a minute and never emits a trailing
      `ago` after `just now`.
- [ ] `countWords` handles an empty doc (`0`), a doc of only whitespace, and
      punctuation-only content.

**Component tests** (`src/routes/_authenticated/notes/-components/__test__/`):

- [ ] `tag-picker` — renders each tag with its count; filters on search input;
      shows `Create "x"` only with `allowCreate` and only when no
      case-insensitive match exists; toggling calls `onToggle`.
- [ ] `notes-filter-popover` — trigger badge counts tags + fav + untagged and
      excludes sort; the match control appears only at ≥2 selected tags; checking
      `Untagged only` clears selected tags in one navigation.
- [ ] `note-list` — with 50 tags in `useNoteTagsQuery`, the header renders no tag
      buttons; the active-filter row is absent with no filters and shows `+N` past
      3; the footer renders Archive with its count and Tags.
- [ ] `note-list-item` — no `border-b`; a 12-tag note renders the same number of
      DOM lines as a 0-tag note; selected row carries the `--sidebar-active`
      classes, not `bg-primary/10`.
- [ ] `note-byline` — tags render as `#tag` buttons; clicking one calls
      `toggleActiveTag`; `＋` is absent when read-only; the save slot changes
      without changing the metadata text node.
- [ ] `note-editor` — header renders 3 controls on mobile and 2 on desktop; the
      overflow menu contains Undo/Redo/Lock/Archive with Undo disabled when
      `canUndo` is false; **no `TagInput`**; **no outline trigger in the header**,
      and the outline floating button still renders as a sibling of the scroll
      region on a mobile viewport.
- [ ] **Existing suites that will break and need updating:** `note-editor.test.tsx`
      (asserts on the tag input and the header buttons), `note-list.test.tsx`
      (asserts on tag chips, sort select, favourites button),
      `note-list-item.test.tsx` (may assert on `border-b` / active class).
- [ ] `note-outline.test.tsx` and `use-note-outline.test.ts` still pass after the
      scroll container gains `max-w-[44rem] mx-auto`.

**Manual verification:**

- [ ] Create 40 tags; confirm the list header stays one row and the picker
      scrolls.
- [ ] Put 12 tags on one note at 360px; confirm the detail header does not wrap.
- [ ] Open the byline picker, then click into the editor body — confirm **no**
      spurious save fires (the `data-note-editor-portal` contract).
- [ ] Open the overflow menu and confirm the same.
- [ ] Select a note, hover a different one — confirm both states read clearly in
      both themes, and neither looks like a coloured decal in light mode.
- [ ] Scroll a long note; confirm the header title fades in and the outline's
      scroll-spy still tracks.
- [ ] On mobile, confirm the outline button is still at the bottom-right after the
      header rebuild, that it lifts to `bottom-24` when the save bar appears, and
      that opening its popover fires no save.
- [ ] At `sm` and at `xl`, confirm no page-level scrollbar and no clipped bottom
      edge.
- [ ] On mobile Safari, scroll to hide the browser chrome; confirm the panes do not
      jump.
- [ ] Tab through the list header, the filter popover, the byline, and the overflow
      menu; every focus ring visible in both themes.
- [ ] Click a `#tag` in the byline; confirm the list filters and the note stays
      open.

## Open Questions

- [x] **`024`'s FAB rationale is now stale and should be amended.** Resolved:
      addressed directly in `024`'s 2026-08-21 amendment ("Mobile trigger
      implemented as a floating action button; its crowding argument is now
      stale"), which keeps the FAB on the reachability argument alone.
- [x] **Pane footer, or two more icons in the header row?** Resolved: built as a
      footer (`note-list.tsx`, `Archive` + `Tags` buttons below the scroll
      region) — Archive and Manage tags are destinations, not filters, and stayed
      out of the filter popover for that reason.
- [ ] **Browser back on mobile.** Fixing it means adding `view: 'list' | 'note'` to
      `notesSearchSchema`, which is URL noise on desktop where the param is
      meaningless, or deriving the view from `note` — which the auto-select effect
      (`index.tsx:69-73`) breaks by setting `note` on load. Recommend deferring to
      its own spec rather than reopening `016`'s search-param contract here.
- [ ] **Does the `＋` trigger need a label?** `＋ Add tag` when a note has no tags,
      bare `＋` once it has some, is the assumption. Confirm the bare `＋` is
      discoverable enough, or keep the label always.
- [ ] **Is `max-w-[44rem]` right for this content?** These notes carry a lot of
      tables and code blocks, which want width more than prose does. 44rem is the
      prose answer; a wider 52rem trades measure for table room. Check against a
      real table-heavy note before committing.
- [ ] **A `⌘K` palette over search + tags** would subsume the search field and the
      picker into one surface, and is where this design eventually wants to go. Out
      of scope: `cmdk` is not a dependency, and a palette hides filter state that
      the active-filter row currently makes visible. Revisit once the layout here
      has settled.

## Amendments

### 2026-08-21 — Truncated text peeks with a tooltip, not a `title`

**What happened:** every container in this spec is bounded by truncating the data
inside it — `line-clamp-1` on list titles and tag runs, `line-clamp-2` on
excerpts, `truncate` on the header title, the byline, the outline labels, the
picker rows, `max-w-32 truncate` on active-filter tokens. Bounding the chrome was
the point. Recovering the text that bounding hides was never specced, so three
places fell back to the native `title` attribute (`note-list.tsx:172`,
`note-outline.tsx:44`, `note-outline.tsx:229`) — the weakest tool available: a
browser-controlled delay of roughly a second, unstyleable, invisible to keyboard
focus, silent on touch, and guaranteed to double-fire the moment a real tooltip is
added next to it.

**Decision — one `TruncatedText`, and a short list of places that get it.**

A shared `src/components/truncated-text.tsx` renders its text and arms a Shadcn
`Tooltip` **only when that text is actually clipped**, measured as
`scrollWidth > clientWidth || scrollHeight > clientHeight` through a
`ResizeObserver` so it covers `truncate` and `line-clamp-*` alike.

The measurement is the whole decision. An always-on tooltip fires on `Intro` as
readily as on a ninety-character heading, so reading the outline would mean dodging
a black box that repeats a word already on screen. A tooltip that exists only when
it has something to add is one nobody has to learn to ignore.

**Where it goes, and where it deliberately does not:**

| Surface                         | Clipped by          | Tooltip                    | Reasoning                                                                                                                                        |
| ------------------------------- | ------------------- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| List row title                  | `line-clamp-1`      | **Yes**                    | Scanning a list is exactly when two notes share a prefix and the tail is the whole answer.                                                       |
| List row tag run                | `line-clamp-1`      | **Yes**                    | "What is this filed under" is only otherwise readable by opening the note.                                                                       |
| List row excerpt                | `line-clamp-2`      | No                         | An excerpt is a **sample**, not a truncated fact. A tooltip holding three lines of prose is a wall, and clicking already gives you the document. |
| Detail header title (on scroll) | `truncate`          | **Yes**                    | The title's own field is scrolled out of view — there is nowhere else on screen to read it.                                                      |
| Outline rail label              | `truncate`          | **Yes**                    | The rail's whole job is deciding whether to click; a clipped heading withholds the decision.                                                     |
| Outline collapsed gutter        | hidden entirely     | No                         | The hover reveal **is** the peek. Two things on one hover is one too many.                                                                       |
| Mobile outline popover row      | `line-clamp-2`      | No                         | Touch has no hover. Wrapping is the fix — see [`024`](./024-notes-table-of-contents.md).                                                         |
| Active-filter token             | `max-w-32 truncate` | **Yes**, replacing `title` | Already conceded it needs a peek; it just picked the wrong mechanism.                                                                            |
| Tag picker row                  | `truncate`          | **Yes**                    | Rare, but a long tag in a `w-64` popover is unreadable and unpickable.                                                                           |
| Byline `#tag` buttons           | wraps               | No                         | Nothing is clipped — the run wraps inside the 44rem measure.                                                                                     |
| Byline `Edited … · N words`     | `truncate`          | No                         | A short fixed string; the `truncate` is a guard that should never fire.                                                                          |

Nine truncations in this workspace, six peeks. The three that stay bare are the
ones where the hidden text is either a sample, already revealed by the same
gesture, or on a device with no pointer.

**Delay.** `SidebarProvider` already mounts `TooltipProvider delayDuration={0}`
around the authenticated tree, which is right for icon buttons whose label you are
hunting and wrong for body text you are reading past. Each `TruncatedText` sets
`delayDuration={500}` on its own `Tooltip` root — long enough that dragging the
pointer down a 30-note list stays silent, short enough to read as a peek rather
than a wait.

**Touch.** Radix tooltips do not open on tap, so this is a pointer affordance and
nothing more. Wherever clipped text is read primarily on a phone, the answer is
wrapping, not a tooltip.

**Screen readers get nothing new, on purpose.** CSS truncation is visual —
`overflow: hidden` does not shorten the accessible name, so a screen reader
already reads the full title, heading, and tag run. Radix would wire the tooltip
up as `aria-describedby` and announce the same string a second time, so
`TooltipContent` is `aria-hidden`. The peek is for eyes that are missing text, not
for readers that are not.

**Copy.** The tooltip holds the exact string it is completing — no prefix, no
label. A tooltip reading `Title: Supabase RLS…` tells you what you knew before you
hovered.

**Removals.** All three `title` attributes go. A native `title` left beside a
Radix tooltip produces both, half a second apart, in two different visual
languages — the single most common way this pattern is shipped broken.

**New acceptance criteria:**

- [ ] Given a note title long enough to clip in the list row, when the pointer
      rests on it, then a tooltip shows the full title after ~500ms.
- [ ] Given a note title short enough to fit, when the pointer rests on it, then no
      tooltip opens.
- [ ] Given any surface in `/notes`, when it renders, then no element carries both a
      `title` attribute and a tooltip.
- [ ] Given a clipped list-row tag run, when the pointer rests on it, then the
      tooltip lists every tag on the note.
- [ ] Given a long note scrolled past its title, when the pointer rests on the
      header title, then the tooltip shows the untruncated title.
- [ ] Given a note-list excerpt, when the pointer rests on it, then no tooltip
      opens, at any excerpt length.
- [ ] Given a keyboard user, when they focus a clipped active-filter token, then the
      tooltip opens on focus and closes on blur or `Escape`.
- [ ] Given a screen reader, when it reads a clipped list row, then the full title
      is announced exactly once.
- [ ] Given the browser window is resized so a fitting title becomes clipped, then
      the tooltip arms without a remount.

**Test plan additions:**

- [ ] `truncated-text` — renders children unchanged; no tooltip role in the
      document when `scrollWidth === clientWidth`; a tooltip appears on hover when
      `scrollWidth > clientWidth`; the same for `scrollHeight`/`clientHeight`;
      `TooltipContent` is `aria-hidden`. (jsdom reports both as `0`, so the tests
      stub the element's `scrollWidth`/`clientWidth` getters — the same technique
      `use-note-outline.test.ts` uses to work around zero-sized layout.)
- [ ] `note-list-item` — the title is wrapped for peeking and the excerpt is not.
- [ ] `note-outline` — no row carries a `title` attribute.

**Manual verification:**

- [ ] Drag the pointer from the top of a full note list to the bottom without
      pausing; confirm nothing pops.
- [ ] Rest on a clipped title, then move to the next row; confirm the tooltip
      follows without re-delaying (Radix's skip-delay window) and does not stack.
- [ ] Zoom to 150%, where more titles clip; confirm tooltips arm for exactly the
      rows that now clip.
- [ ] Confirm the tooltip is legible over both the note list's `--sidebar` field
      and the prose, in both themes.

### 2026-08-21 — The thesis extends to the outline column

**What happened:** this spec's title is "Chrome That Does Not Grow", and the audit
behind it caught the list header, the detail header, and the list row — but not the
one column it did not own. [`024`](./024-notes-table-of-contents.md)'s rail
unmounts entirely when a note has no headings, so `mx-auto max-w-[44rem]` — added
here — re-centres the prose every time the reader switches between a note with
sections and one without. Chrome sized by data, in the pane this spec re-measured.

**Decision:** fixed in `024`, not here — the component and its three responsive
states belong to that spec, and this spec's "No change to the outline's behavior"
non-goal stands. What this spec contributes is the argument: the outline column now
holds a `w-6` gutter at `md` and up regardless of content, because capping the
measure at 44rem is exactly what made the reclaimed width worthless. See
[`024`'s 2026-08-21 amendment](./024-notes-table-of-contents.md#2026-08-21--the-rail-keeps-its-gutter-the-collapsed-state-stops-leaking-letter-fragments).

**Acceptance criterion this spec now carries:**

- [ ] Given any two notes that both have headings, when the reader switches
      between them at `md` and up, then the prose column does not move
      horizontally. (Switching to or from a note with no headings settles the
      rail at the `w-6` gutter rather than unmounting it — see `024`'s accepted
      discontinuity for the one case where that still shifts the column.)

### 2026-08-21 — The byline gains a creation date

**What happened:** the byline was designed as the note's identity line — "what
this note is, how big it is, when it was touched, what it is filed under, in one
readout" — and it left out when the note came into existence. `createdAt` is
already on `NoteSummary` (`notes-store.ts:13`), already selected by the list query,
and never surfaced anywhere in the app.

**Decision — created is absolute, edited stays relative.**

```
Supabase RLS
Edited 2h ago · Created Aug 12 · 412 words          Unsaved changes
#spec  #q3   ＋
```

Two relative times side by side (`Created 9 days ago · Edited 2h ago`) make the
reader do arithmetic to place either one, and both drift while the note is open.
The two values are not the same kind of fact: **creation is a fixed point in the
archive** — a date you could look up — and **last-edit is a recency signal**. So
they get different registers, which is also what makes the pair readable at a
glance instead of a log line.

**Format:** `MMM d`, matching `formatTransactionDate`'s existing vernacular
elsewhere in the app (`Aug 12`, not `12 Aug`). The year is omitted in the current
year and appended otherwise — `Created Aug 12` this year, `Created Aug 12, 2025`
after the turn. One rule, one exception, and the common case stays short.

**Order:** `Edited · Created · words`. The live value leads, the two timestamps sit
adjacent, and the word count goes last because it is the segment that costs least
when the line truncates on a narrow phone. Creation date specifically must survive
that truncation — it is the fact being added.

**Type:** `Aug 12` is wrapped whole in `.tabular`, exactly as `formatTimeAgo`'s
`2h ago` already is. The date is a quantity in the design system's sense, and
wrapping the whole string rather than just the digits is the precedent the byline
already set.

**The exact timestamps get one tooltip, not two.** Both visible values are
deliberately imprecise — `2h ago` and `Aug 12` are the readable forms, and the
instant is what a reader occasionally needs. Resting on the metadata run opens a
single tooltip carrying both, as an aligned two-row readout:

```
┌────────────────────────────────┐
│ Created   Aug 12, 2026  9:41 AM │
│ Edited    Aug 21, 2026  2:03 PM │
└────────────────────────────────┘
```

Labels in Inter, values in `.tabular` and right-aligned so the two timestamps
compare on sight. This is the byline's catalog register taken to its end: the run
you read is the summary, the tooltip is the record.

**This is the one sanctioned unconditional tooltip in `/notes`.** The
[`TruncatedText`](#2026-08-21--truncated-text-peeks-with-a-tooltip-not-a-title)
amendment above fires only on clipped text, on the principle that a tooltip must
add something the screen does not already carry. This one passes the same test for
a different reason: the abbreviation is unconditional, so the precise value is
_always_ missing, not sometimes. It is a separate mechanism from `TruncatedText`
and must not be built on top of it — one target on the metadata run, `delayDuration`
matched at `500`.

**Paying for the width.** On a 360px phone the metadata run measures roughly 256px
inside a 312px content box — it fits, until `Unsaved changes` claims ~96px on the
right and pushes it into truncation. Rather than shorten the new fact, the byline's
save indicator is hidden below `sm` (`hidden sm:inline`). This spec already
observed that the indicator "duplicates the `UnsavedChangesBar`, which is
purpose-built for exactly this" and kept it anyway; on a phone, where the save bar
is a full-width pill at the bottom of the same screen, the duplication is not worth
a truncated byline. No `aria` change — the indicator was already deliberately not a
live region, and `UnsavedChangesBar` owns the `role="status"` announcement.

**Copy:**

| Element        | String                                        |
| -------------- | --------------------------------------------- |
| Byline segment | `Created Aug 12` / `Created Aug 12, 2025`     |
| Tooltip rows   | `Created` / `Edited`, then the full timestamp |
| Tooltip values | `Aug 12, 2026  9:41 AM`                       |

`Created`, not `Added` or `Filed` — the library-catalog register is carried by the
typography, not by reaching for a cleverer verb than the one every notes app uses.

**Not in scope:**

- **The list row keeps `updatedAt` only.** The list is sorted by recency and
  bounded to three lines; a second timestamp there is data pushed into chrome, which
  is what this spec exists to undo.
- **The archived-notes sheet is unchanged.** Archive rows have their own purge
  countdown to carry.
- **No sort-by-created option.** `notesSearchSchema` already offers
  `created-desc`; this amendment only displays the value.

**New utilities** (`src/utils/date.ts`):

- `formatShortDate(isoDate)` → `Aug 12`, or `Aug 12, 2025` when the year differs
  from the current one. Distinct from `formatDateTimeLabel`, which never emits a
  year.
- `formatExactTimestamp(isoDate)` → `Aug 12, 2026 9:41 AM`, for the tooltip rows.

**New acceptance criteria:**

- [ ] Given a note created this year, when it is open, then the byline reads
      `Edited <relative> · Created <MMM d> · <n> words` with no year.
- [ ] Given a note created in a previous year, when it is open, then the creation
      date includes the year.
- [ ] Given the byline, when the pointer rests on the metadata run, then one
      tooltip opens showing the full creation and edit timestamps as two aligned
      rows.
- [ ] Given a viewport below `sm`, when the note is dirty, then the byline shows no
      save indicator and the metadata run is not truncated.
- [ ] Given a viewport at `sm` and up, when the note is dirty, then the save
      indicator is present and the metadata run does not shift.
- [ ] Given a read-only note, when it is open, then the creation date renders
      exactly as it does on an editable note.
- [ ] Given a note edited during the session, when it saves, then the creation date
      does not change and the metadata run does not reflow beyond the relative time.

**Test plan additions:**

- [ ] `formatShortDate` — omits the year within the current year, includes it
      otherwise; boundary case of Dec 31 / Jan 1 across the turn.
- [ ] `formatExactTimestamp` — stable output for a fixed ISO input under a pinned
      clock.
- [ ] `note-byline` — renders `Created` with the short date; the date carries
      `.tabular`; a note whose `createdAt` is in a prior year shows the year; the
      save indicator carries the `sm` visibility classes; the tooltip exposes both
      timestamps.

**Manual verification:**

- [ ] Open a note created today and one created last year; confirm both lines read
      naturally and neither wraps at `sm`.
- [ ] At 360px with unsaved changes, confirm the whole metadata run is readable and
      the save bar is the only place reporting save state.
- [ ] Rest on the metadata run in both themes; confirm the two-row tooltip's values
      align on the same left edge.
