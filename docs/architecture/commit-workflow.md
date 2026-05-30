# Commit Workflow

This project enforces commit quality checks with **Husky**, **lint-staged**, and **commitlint**.

Related architecture docs:

- `docs/architecture/feature-slices.md` for slice layout and scope naming (`habits`, `finance`, `notes`, `globals`)
- `docs/architecture/testing.md` for test runner setup, file placement, and coverage
- `docs/architecture/pwa.md` for installability and offline setup

## What runs on commit

### `pre-commit` hook

Husky runs `lint-staged`, which only checks **staged files**:

- `**/*.{ts,tsx}`
  - `prettier --write`
  - `eslint --fix --cache --cache-location .cache/eslint`
- `**/*.{json,md,css}`
  - `prettier --write`

This keeps commit checks fast while still enforcing formatting and linting.

> **Note:** Pre-commit hooks do **not** run Vitest. Run tests manually with `bun --bun run test` before pushing. See `docs/architecture/testing.md`.

### `commit-msg` hook

Husky runs `commitlint` to enforce the Conventional Commits format:

`type(scope): description`

Examples:

- `feat(globals): add shared utils date`
- `fix(finance): handle zero balance edge case`
- `chore: update dependencies`
- `chore: Enhance commit workflow by integrating Husky, lint-staged, and commitlint for improved commit quality checks`

Use feature or layer names from `docs/architecture/feature-slices.md` as the `(scope)` when applicable.

## Commitlint overrides

This project extends `@commitlint/config-conventional` with two relaxed rules in `commitlint.config.ts`:

| Rule                | Default            | This project |
| ------------------- | ------------------ | ------------ |
| `header-max-length` | 100                | **200**      |
| `subject-case`      | lowercase required | **disabled** |

All other Conventional Commits rules from the preset still apply (valid `type`, required colon separator, etc.). Sentence-case subjects and longer headers are allowed.

## Why this setup

- Staged-only checks reduce local commit time.
- ESLint cache speeds up repeat commits.
- Standardized commit messages keep history readable and help release tooling.

## Files involved

- `package.json` (`prepare`, `lint-staged`)
- `.husky/pre-commit`
- `.husky/commit-msg`
- `commitlint.config.ts`
- `.gitignore` (`.cache/`)
