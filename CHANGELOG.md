# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

See [`docs/architecture/changelog-workflow.md`](docs/architecture/changelog-workflow.md)
for how and when entries are added.

## [0.0.4] - 2026-08-15

### Added

- Archive: notes and transactions are now soft-deleted instead of destroyed.
  Deleting either moves it to a new `/archive` page (tabs for Second Brain
  and Finance), where it can be restored with one click or permanently
  deleted. Archived items are purged automatically after 30 days.
- Confirmation before archiving a transaction — this action previously had
  no confirmation at all. Deleting a note or a transaction now shows the
  same confirm dialog, followed by a toast with an Undo action.
- Archived notes and transactions are now also reachable without leaving
  the feature: an Archive button in the Second Brain list header opens a
  side panel of archived notes, and Finance gets a third "Archive" tab
  alongside Chart and Table. Both mirror `/archive`'s Restore and Delete
  permanently actions.

### Changed

- Notes and finance queries now exclude archived rows everywhere (list,
  detail, search, tag counts, `[[link]]` targets, charts, stat cards) — an
  archived item behaves like it no longer exists until restored.
- Finance: the Chart/Table/Archive tab strip now stays visible whenever
  there are archived transactions, even with an empty live ledger, so the
  Archive tab is never one archive-everything action away from vanishing.
  The filter bar and stat cards hide while the Archive tab is active, since
  neither applies to it.

## [0.0.3] - 2026-08-14

### Added

- Data table: optional column resizing (drag or keyboard — arrow keys,
  `Shift` for a bigger step, `Home`/double-click to reset), persisted per
  table. Opt-in via `resizable`/`tableId` on `DataTable`; enabled on the
  Finance transactions table, with a "Reset widths" control once any column
  is customized.
- Data table: a density control (compact/default/comfortable), persisted
  per table.
- Data table: an optional sticky header for long pages of rows, enabled on
  the Finance transactions table.

### Changed

- Data table: switched to a fixed column-width layout so widths no longer
  jitter when paging, sorting, or filtering. Long content in the Note and
  Location columns now truncates/wraps in place instead of silently
  widening the table.
- Data table: hover and selected row states now use the `--accent` token
  instead of `--muted`, so they read clearly against a striped row
  (previously both were the same token ten opacity points apart).
- Data table: amounts and row actions are right-aligned; alignment and
  overflow behavior are now declared per column (`meta.align`/
  `meta.overflow`) instead of hardcoded into cell markup.
- Data table: first load now shows skeleton rows and a background refetch
  dims the existing rows in place, replacing a "Loading…" label next to the
  Transactions heading.
- Design system: dark mode lifted off near-black (`#010101`) onto a legible
  three-step surface ladder (background/card/popover) with comfortable
  (not maximal) text contrast; light mode neutrals now carry a warm paper
  tint instead of pure grey.
- Design system: added `--success`, `--warning`, `--money-in`,
  `--money-out`, and `--favorite` tokens; Finance and Second Brain no longer
  hardcode `emerald`/`rose`/`amber` Tailwind literals for income, expenses,
  and favorites.
- Design system: quantities (balances, transaction amounts, chart values,
  streaks, timestamps, deadlines, counts) now render in a dedicated
  tabular-figure numeric face across Finance, Second Brain, Habits, and
  Tasks.
- Design system: Inter and IBM Plex Mono are now self-hosted instead of
  loaded from the Google Fonts CDN, so the installed PWA renders correctly
  offline.
- Design system: the finance chart categorical palette (`--chart-1..5`) was
  redefined with colorblind-safe, contrast-validated values for both
  themes.

### Fixed

- Sidebar: the active/hovered item no longer renders as a violet tint with
  almost no lightness separation from the sidebar field (a decal effect
  rather than a state change). Hover and selected are now distinct
  neutral-surface steps — hover sinks, selected rises with a hairline
  border — with brand color moved to the icon/label instead of the
  background. The same fix applies to the global `--accent` token used by
  dropdown menus, selects, and table rows, which had the identical defect.

## [0.0.2] - 2026-08-10

### Added

- Notes (Second Brain): a floating "Unsaved changes" bar appears at the
  bottom-center of the editor when a note has unsaved edits, with a **Save**
  button and a `Ctrl`/`Cmd`+`S` hint.
- Notes (Second Brain): reloading or closing the tab with unsaved edits now
  shows the browser's native confirmation dialog.

### Changed

- Notes (Second Brain): the editor no longer autosaves while typing. Saves
  now happen when focus leaves the editor pane, on `Ctrl`/`Cmd`+`S`, when
  switching notes, or when navigating away — plus the new **Save** button.

### Fixed

- Notes (Second Brain): opening a note that ends in a list, table, or code
  block no longer silently rewrites it — merely viewing a note issued a
  phantom save that bumped `updated_at` and enabled Undo as if an edit had
  been made.

## [0.0.1] - 2026-08-09

### Added

- Author contact information (name, email, homepage) to `package.json`.

### Fixed

- Notes (Second Brain): creating a new note while another note was open no
  longer leaves the new note's body populated with the previous note's
  stale content — `NoteEditor` is now keyed by note id so it fully remounts
  on note switch instead of reusing state across notes.
