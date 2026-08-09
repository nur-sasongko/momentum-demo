# Changelog Workflow

Related docs:

- [`../../CHANGELOG.md`](../../CHANGELOG.md) — the changelog itself
- [`commit-workflow.md`](commit-workflow.md) — Conventional Commits format enforced by commitlint
- [`spec-workflow.md`](spec-workflow.md) — spec lifecycle for larger features

## Format

`CHANGELOG.md` follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)
and [Semantic Versioning](https://semver.org/spec/v2.0.0.html). It is
maintained by hand — there is no changelog-generation tool wired up.

## When to add an entry

Add a bullet for any `feat` or `fix` commit that changes user-visible
behavior. Skip `chore`, `docs`, `test`, `refactor`, `style`, and `ci`
commits unless they have a user-facing effect worth calling out.

Add the entry in the same commit/PR as the change, under `## [Unreleased]`
in `CHANGELOG.md`.

## Category mapping

Map the Conventional Commit `type` (see `commit-workflow.md`) to a Keep a
Changelog section:

| Commit type                        | Changelog section |
| ---------------------------------- | ----------------- |
| `feat` (new capability)            | `Added`           |
| `feat` (changes existing behavior) | `Changed`         |
| `fix`                              | `Fixed`           |
| marking something deprecated       | `Deprecated`      |
| removing a feature                 | `Removed`         |
| security fix                       | `Security`        |

Only include the section headers that actually have entries under
`[Unreleased]`.

## Cutting a release (once git tagging starts)

1. Rename `## [Unreleased]` to `## [x.y.z] - YYYY-MM-DD`, matching the tag
   you're about to create.
2. Add a fresh empty `## [Unreleased]` section above it.
3. Bump `version` in `package.json` to match `x.y.z`.
4. Commit as `chore(release): vX.Y.Z`.
5. Create the git tag (`git tag vX.Y.Z`) and push it.

## Versioning guide

This is a single-maintainer personal app, not a published library, so keep
SemVer judgment lightweight:

- **Patch** (`0.0.x`) — bug fixes only, no new user-facing capability.
- **Minor** (`0.x.0`) — backwards-compatible new features.
- **Major** (`x.0.0`) — breaking changes (e.g. incompatible data migration,
  removed feature).
