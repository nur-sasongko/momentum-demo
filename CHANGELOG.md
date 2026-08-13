# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

See [`docs/architecture/changelog-workflow.md`](docs/architecture/changelog-workflow.md)
for how and when entries are added.

## [Unreleased]

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
- Data table: hover and selected row states now use the violet-tinted
  `--accent` token instead of `--muted`, so they read clearly against a
  striped row (previously both were the same token ten opacity points
  apart).
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
