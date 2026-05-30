# Testing

This project uses **Vitest** as the test runner with **jsdom** for DOM environment and **istanbul** for coverage.

Related architecture docs:

- `docs/architecture/commit-workflow.md` for Husky hooks, staged checks, and commit message format
- `docs/architecture/feature-slices.md` for slice layout and test file placement conventions
- `docs/architecture/pwa.md` for installability and offline setup

## Running tests

```bash
bun --bun run test          # run all tests (vitest run)
bun --bun run test:coverage # run tests with istanbul coverage report
bunx vitest run src/path/to/file.test.ts  # run a single test file
```

> **Important:** Do NOT use `bun test`. That invokes Bun's native test runner which has no Vitest globals (`vi`, `describe`, `it`, etc.). Always use `bun --bun run test`.

> **Commit hooks vs tests:** The `pre-commit` hook runs `lint-staged` (Prettier + ESLint on staged files only). It does **not** run the test suite. Run `bun --bun run test` manually before pushing. See `docs/architecture/commit-workflow.md` for hook behavior and commit message rules.

## Config

- Test runner: `vitest.config.ts` — separate from `vite.config.ts` so test runs don't load SSR/PWA/Tailwind plugins
- Environment: `jsdom` (DOM APIs available in all tests)
- Globals: `true` — no need to import `describe`/`it`/`expect`/`vi` per file
- Path alias: `#` → `src/` (mirrors `package.json` `imports`)
- Coverage provider: `@vitest/coverage-istanbul` (works with Bun runtime; V8 provider requires Node.js inspector APIs which Bun does not support)
- Coverage reporters: `text` (terminal), `html` (`coverage/index.html`), `lcov`

## Test file placement

| Layer                                 | Test location                                               | Why                                                                        |
| ------------------------------------- | ----------------------------------------------------------- | -------------------------------------------------------------------------- |
| Global utils (`src/utils/`)           | `src/utils/__tests__/<name>.test.ts`                        | Keeps source files clean; `__tests__/` is standard outside route folders   |
| Feature components (`src/routes/...`) | `src/routes/<feature>/-components/__test__/<name>.test.tsx` | Keeps tests next to the component they verify                              |
| Feature utilities (`src/routes/...`)  | `src/routes/<feature>/-utils/__test__/<name>.test.ts`       | Keeps tests next to helper modules and avoids a catch-all feature test bin |

## Writing a global utility test

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { myHelper } from '#/utils/my-helper'

describe('myHelper', () => {
  it('does the thing', () => {
    expect(myHelper()).toBe('expected value')
  })
})
```

Use `vi.useFakeTimers()` + `vi.setSystemTime()` when the function depends on the current date:

```ts
beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-05-30T00:00:00.000Z'))
})

afterEach(() => {
  vi.useRealTimers()
})
```

## Coverage

The coverage report includes all `src/**/*.{ts,tsx}` files. Test files and `src/routeTree.gen.ts` are excluded.

Open `coverage/index.html` in a browser for the interactive HTML report after running `bun --bun run test:coverage`.
