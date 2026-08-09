# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

See [`docs/architecture/changelog-workflow.md`](docs/architecture/changelog-workflow.md)
for how and when entries are added.

## [0.0.1] - 2026-08-09

### Added

- Author contact information (name, email, homepage) to `package.json`.

### Fixed

- Notes (Second Brain): creating a new note while another note was open no
  longer leaves the new note's body populated with the previous note's
  stale content — `NoteEditor` is now keyed by note id so it fully remounts
  on note switch instead of reusing state across notes.
