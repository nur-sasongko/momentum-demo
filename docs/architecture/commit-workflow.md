# Commit Workflow

This project enforces commit quality checks with **Husky**, **lint-staged**, and **commitlint**.

## What runs on commit

### `pre-commit` hook

Husky runs `lint-staged`, which only checks **staged files**:

- `**/*.{ts,tsx}`
  - `prettier --write`
  - `eslint --fix --cache --cache-location .cache/eslint`
- `**/*.{json,md,css}`
  - `prettier --write`

This keeps commit checks fast while still enforcing formatting and linting.

### `commit-msg` hook

Husky runs `commitlint` to enforce the Conventional Commits format:

`type(scope): description`

Examples:

- `feat(globals): add shared utils date`
- `fix(finance): handle zero balance edge case`
- `chore: update dependencies`

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
