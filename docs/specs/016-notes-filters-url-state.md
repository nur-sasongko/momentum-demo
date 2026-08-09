---
id: 16
title: 'Notes Filters, Sort & Selected Note as URL Search Params'
status: in-progress
feature: notes
created: 2026-08-09
updated: 2026-08-09
---

# Notes Filters, Sort & Selected Note as URL Search Params

## Problem Statement

Every piece of Notes navigation state — which note is open, the search text, the active tag filters, the tag AND/OR mode, the untagged-only and favorites-only toggles, and the sort order — lives in `useNotesStore`. A user cannot send anyone a link to a specific note, cannot bookmark "my favorites sorted by title", and cannot press Back to undo a filter change (Back leaves `/notes` entirely). Worse, three of those fields (`sortBy`, `favoritesOnly`, `tagFilterMode`) are persisted to `localStorage` while the rest are not, so a reload restores a half-remembered view: the sort and the favorites toggle survive, the tags and search text do not. The route loader has to read the store imperatively (`useNotesStore.getState()`) to prefetch the right first page, which means the prefetch key and the URL can never be derived from the request alone.

## Goals

- Move `selectedId`, `searchQuery`, `activeTags`, `tagFilterMode`, `untaggedOnly`, `favoritesOnly`, and `sortBy` out of `useNotesStore` into validated TanStack Router search params on `/_authenticated/notes/`.
- Keep every consumer's read/write shape unchanged behind one new hook (`useNotesFilters`), so migrating a component is a one-line hook swap rather than a rewrite.
- Make an open note and a filtered list a copyable, shareable, bookmarkable URL.
- Make the browser Back button undo the most recent filter change or note selection.
- Make the route loader derive its prefetch cache key from `loaderDeps` (the URL) instead of reading Zustand state imperatively.
- Follow the pattern established by spec 11 (`finance-filters-url-state`) rather than inventing a second approach.

## Non-Goals

- Not moving `linkTargets` (the wiki-link autocomplete source) out of `useNotesStore` — it is derived data cached for the editor, not navigation state.
- Not putting the read-only lock toggle or editor-local UI state (tag popover, manager dialog open) into the URL.
- Not adding pagination state to the URL — the list is an infinite query; a shared link reproduces filters and the open note, and reloads from page 1.
- Not changing what the filters filter, how `buildNotesTsQuery` works, or any Supabase query shape.
- Not preserving the currently persisted `sortBy` / `favoritesOnly` / `tagFilterMode` across reloads. This is a deliberate behavior change: those three become URL state like the rest, so a plain `/notes` visit starts from documented defaults. Keeping them persisted would mean a bare `/notes` and a shared `/notes` render differently for two users, which defeats the point of shareable URLs.
- Not generalizing `useNotesFilters` and `useFinanceFilters` into a shared abstraction — two instances of the pattern is not yet enough evidence for one.

## Acceptance Criteria

- [x] Given a user opens a note, when they look at the URL, then it contains `?note=<id>`, and pasting that URL in a new tab opens the same note.
- [x] Given a user types in the search box, when the debounce settles, then the URL reflects the query as `?q=<text>` and the list is filtered accordingly.
- [x] Given a user activates tag filters, a tag mode, untagged-only, favorites-only, or a sort order, when they look at the URL, then each is present as its own param (`tags`, `tagMode`, `untagged`, `fav`, `sort`).
- [x] Given no filters are active and the default sort is in effect, when viewing the URL, then no filter params appear at all — defaults are stripped, not written.
- [x] Given a hand-typed URL with a bare scalar tag (`?tags=work`), when the page loads, then it is treated as the single-element array `['work']`.
- [x] Given a malformed URL (e.g. `?sort=bogus&tagMode=XOR&fav=maybe`), when the page loads, then each invalid field degrades to its default instead of throwing a route error.
- [x] Given a user changes a filter and presses Back, then the previous filter combination is restored without leaving `/notes`.
- [x] Given a user toggles several tags in a row, when they press Back once, then they return to the pre-tag-filtering state rather than stepping through each intermediate toggle (non-boundary toggles coalesce — see the push/replace table under UI / UX Notes).
- [x] Given no note is selected and the list has at least one note, when the page settles, then the first note is auto-selected via a `replace` navigation, so Back does not bounce between "nothing selected" and "first note selected".
- [x] Given the search input's debounced value already equals the URL's `q`, when the effect runs, then no navigation is issued (no redundant loader re-run).
- [x] Given a tag is renamed or deleted from the tag manager, when the rename/delete succeeds, then an active filter on the old tag is rewritten to the new name (rename) or dropped (delete), in the URL.
- [x] Given the route loads, then the loader prefetches the note list using params derived from `loaderDeps`, with no `useNotesStore.getState()` call.
- [x] Given a filter changes, when the list re-renders, then the scroll position does not jump (`resetScroll: false`).

## Data Model Changes

**Store:** `src/stores/notes-store.ts`

Removed from `NotesState`: `selectedId`, `searchQuery`, `activeTags`, `tagFilterMode`, `untaggedOnly`, `favoritesOnly`, `sortBy`, the `TagFilterMode` and `NotesSortBy` type exports, and the actions `selectNote`, `setSearch`, `setActiveTags`, `toggleActiveTag`, `setTagFilterMode`, `setUntaggedOnly`, `setFavoritesOnly`, `setSortBy`.

Kept: `linkTargets` and `setLinkTargets`. `NoteSummary` and `Note` stay exported from here — they are the app's client-side note types and are imported widely.

```ts
// before — persisted, 8 filter fields + 8 actions
export const useNotesStore = create<NotesState>()(
  persist(
    (set, get) => ({
      /* selectedId, searchQuery, activeTags, ... */
    }),
    {
      name: 'myspace-notes',
      version: 5,
      partialize: (s) => ({
        sortBy: s.sortBy,
        favoritesOnly: s.favoritesOnly,
        tagFilterMode: s.tagFilterMode,
      }),
    },
  ),
)

// after — plain store, no persist middleware
export const useNotesStore = create<NotesState>()((set) => ({
  linkTargets: [],
  setLinkTargets: (targets) => set({ linkTargets: targets }),
}))
```

**Migration:** the `persist` middleware is **removed entirely** rather than version-bumped. Nothing left in the store is worth persisting, so there is no hydration path to migrate and no `version` to advance. The stale `myspace-notes` `localStorage` key is simply orphaned — it is never read again and is harmless; no cleanup code is added for it.

**New:** `src/routes/_authenticated/notes/-utils/notes-route-search.ts` — the zod schema `notesSearchSchema` plus the `NotesSortBy` / `TagFilterMode` types (moved here from the store), `NOTES_SEARCH_DEFAULTS`, and `NOTES_ROUTE_ID`.

| Param      | Type                                                              | Default          | Meaning              |
| ---------- | ----------------------------------------------------------------- | ---------------- | -------------------- |
| `note`     | `string \| undefined`                                             | `undefined`      | Open note id         |
| `q`        | `string`                                                          | `''`             | Search text          |
| `tags`     | `string[]`                                                        | `[]`             | Active tag filters   |
| `tagMode`  | `'AND' \| 'OR'`                                                   | `'OR'`           | Tag combination mode |
| `untagged` | `boolean`                                                         | `false`          | Untagged-notes-only  |
| `fav`      | `boolean`                                                         | `false`          | Favorites-only       |
| `sort`     | `'updated-desc' \| 'created-desc' \| 'title-asc' \| 'title-desc'` | `'updated-desc'` | List sort order      |

Every field carries `.catch(<default>)` so an invalid value degrades field-by-field. `tags` additionally runs a `z.preprocess` that wraps a bare scalar into a one-element array, so a hand-typed `?tags=work` works.

## UI / UX Notes

No visual change. This is a state-plumbing migration — every screen looks and behaves identically, except:

- The URL updates as the user opens notes and changes filters (e.g. `/notes?note=abc123&fav=true&sort=title-asc`).
- Back/Forward step through filter and note-selection history instead of leaving the page.
- A copied/bookmarked notes URL reproduces the open note and the filtered list.
- Sort order, favorites-only, and tag mode no longer survive a reload of a bare `/notes` (see Non-Goals).

**New hook:** `src/routes/_authenticated/notes/-utils/use-notes-filters.ts` (`useNotesFilters()`) wraps `getRouteApi(NOTES_ROUTE_ID)`'s `useSearch`/`useNavigate` and exposes exactly the field and action names the store used to, so each consumer swaps `useNotesStore` selectors for one destructure. `selectNote` gains an optional `{ replace }` argument for the auto-select-first-note case.

Two design details in the hook matter:

- **Stable action identities.** Every action is wrapped in `useCallback` with only `[navigate]` (or `[apply]`) as a dependency, matching the identity guarantee Zustand actions had. Consumers put these setters in effect dependency arrays; a fresh identity per render would re-fire those effects, and each redundant `navigate()` to an unchanged URL makes the router re-run the route loader → render → fire the effect again.
- **A `searchRef` for current values.** Actions that need to read the current search state (`toggleActiveTag`, `setActiveTags`, `setUntaggedOnly`) read it through a ref updated on every render, so current values never become `useCallback` dependencies and never destabilize the identities above.

**Push vs replace:**

| Action                                                                               | History |
| ------------------------------------------------------------------------------------ | ------- |
| `setSearch` (debounced text)                                                         | replace |
| `toggleActiveTag` — first tag on, or last tag off                                    | push    |
| `toggleActiveTag` — any intermediate toggle                                          | replace |
| `selectNote`, `setTagFilterMode`, `setUntaggedOnly`, `setFavoritesOnly`, `setSortBy` | push    |
| `selectNote` for the auto-select-first-note effect                                   | replace |

Rationale: one deliberate user decision should cost one Back press. Typing 20 characters is one decision, not 20; picking three tags to filter by is one decision whose boundaries are "started filtering" and "stopped filtering".

## Edge Cases

- **Empty state:** a bare `/notes` carries no filter params at all — a `stripSearchParams(NOTES_SEARCH_DEFAULTS)` search middleware is mandatory, not cosmetic, because `navigate()` re-validates and re-injects every zod default on every call; without stripping, one click would write `?q=&tags=[]&tagMode=OR&untagged=false&fav=false&sort=updated-desc`.
- **Persistence boundary:** nothing about the Notes view survives a reload except through the URL itself. Note _data_ is in Supabase; the read-only lock toggle keeps its own `localStorage` entry and is untouched.
- **Clearing a value:** `selectNote(null)` writes `note: undefined`, never `null` — the encoder drops `undefined` keys but stringifies `null` to the literal text `"null"`.
- **Mutually exclusive filters:** `untagged` and `tags` cannot both be active. Setting tags clears `untagged`; setting `untagged` clears `tags` — both in the same navigation, so no intermediate zero-row render.
- **Debounced search vs URL:** the `note-list.tsx` effect that pushes the debounced input to the URL early-returns when `debouncedInput === searchQuery`, which covers both mount and the render right after the URL catches up.
- **Deleted / renamed tag under an active filter:** `useRenameTagMutation` / `useDeleteTagMutation` no longer reach into the store from module scope. They call `useNotesFilters()` at hook level and pass `activeTags` + `setActiveTags` into the `replaceActiveTag` helper, which is now a pure function of its arguments.
- **Stale `note` id:** a shared link whose note was since deleted falls through to the existing "note not found" path; the auto-select effect only fires when `selectedId` is absent, so a dangling id is not silently replaced.

## Implementation Notes

1. `src/routes/_authenticated/notes/-utils/notes-route-search.ts` (new) — zod schema, `NotesSortBy`, `TagFilterMode`, `NOTES_SEARCH_DEFAULTS`, `NOTES_ROUTE_ID`.
2. `src/routes/_authenticated/notes/-utils/use-notes-filters.ts` (new) — the hook, with the stable-identity and `searchRef` design above.
3. `src/routes/_authenticated/notes/index.tsx` — add `validateSearch`, the `stripSearchParams` middleware, and `loaderDeps`; rewrite the loader to build params from `deps` via `toNotesListParams`; drop the `DEFAULT_LIST_PARAMS` constant and the `useNotesStore.getState()` read; auto-select the first note with `{ replace: true }`.
4. `src/routes/_authenticated/notes/-utils/notes-queries.ts` — extract `toNotesListParams(input)` as a pure normalizer shared by the loader and `useNotesListParams`; point `useNotesListParams` at `useNotesFilters`; make `replaceActiveTag` take `activeTags`/`setActiveTags` as parameters; re-export the sort/mode types from `notes-route-search`.
5. Migrate consumers: `note-list.tsx` (14 selectors → one destructure, plus the debounce guard), `note-editor.tsx`, `note-list-item.tsx`, `notes-empty-state.tsx`.
6. `src/stores/notes-store.ts` — delete the filter fields/actions, the two type exports, and the `persist` wrapper.
7. `docs/second-brain.md` — rewrite the "State and persistence" section (currently documents storage key `myspace-notes`, version 5, and the persisted `sortBy`/`favoritesOnly`/`tagFilterMode` slice) and document the URL contract with an example.

## Test Plan

**Unit tests** (`src/routes/_authenticated/notes/-utils/__test__/`):

- [ ] `notes-route-search.test.ts` — each field round-trips `stringify → parse → validate`; `?tags=["a","b"]` → `['a','b']`; bare `?tags=a` → `['a']`; `?sort=bogus` → `'updated-desc'`; `?tagMode=XOR` → `'OR'`; `?fav=maybe` → `false`; missing keys → the documented defaults.
- [ ] `use-notes-filters.test.tsx` (memory-history route harness) — action identities are stable across re-renders; `setActiveTags` with a non-empty array clears `untagged` in one navigation and vice versa; `toggleActiveTag` pushes on the empty↔non-empty boundaries and replaces in between (asserted via `history.length`); `selectNote(null)` produces a URL with no `note` param.
- [ ] `notes-queries.test.ts` — `toNotesListParams` trims and nulls blank search text and sorts `activeTags` (stable cache key regardless of click order).

**Component tests** (`src/routes/_authenticated/notes/-components/__test__/`):

- [x] `note-list.test.tsx` passes with its `useNotesStore.setState` fixture replaced by a `vi.mock` of `useNotesFilters` behind a `mockNotesFilters(overrides)` helper.
- [x] `note-editor.test.tsx` and `note-list-item.test.tsx` pass with `useNotesFilters` mocked instead of the store.
- [ ] A `note-list.test.tsx` case asserting the debounce effect issues no `setSearch` call when the debounced value already equals `searchQuery`.

**Manual verification:**

- [ ] Open `/notes`, click a note, confirm `?note=<id>` and that the URL opens the same note in a fresh tab.
- [ ] Type a search query, confirm `?q=` appears once (not per keystroke) and one Back press clears the whole query.
- [ ] Toggle three tags, switch to AND, set favorites-only, sort by title; confirm each param appears and Back walks the sequence sensibly.
- [ ] Confirm a bare `/notes` has a completely clean URL after the first note auto-selects (only `?note=`).
- [ ] Load `/notes?sort=bogus&tagMode=XOR&fav=maybe&tags=work` and confirm defaults are applied, `tags` becomes `['work']`, and nothing throws.
- [ ] Rename a tag while filtering on it; confirm the URL's `tags` entry is rewritten. Delete it; confirm the entry is dropped.
- [ ] Scroll the list, toggle a filter, confirm no scroll jump.
- [ ] Confirm the read-only lock toggle still persists across reloads.

## Open Questions

- [x] Should `sortBy` / `favoritesOnly` / `tagFilterMode` stay in `localStorage` alongside the URL? — **No.** Two sources for one value means a shared link renders differently per recipient. Resolved in favor of URL-only; recorded in Non-Goals.
