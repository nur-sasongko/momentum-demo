---
title: ''
status: draft
feature: habits
created: YYYY-MM-DD
updated: YYYY-MM-DD
---

# [Title]

## Problem Statement

<!--
One paragraph. What user pain or missing capability does this spec address?
Avoid solution language — describe what the user currently cannot do.
-->

## Goals

- Goal 1

## Non-Goals

<!--
At least one item. Documents deliberate scope boundaries.
-->

- Not addressing X

## Acceptance Criteria

<!--
BDD-style: independently verifiable conditions.
Each checkbox can be confirmed by someone else without asking for clarification.
-->

- [ ] Given [precondition], when [action], then [outcome]
- [ ] [Edge case] is handled by [behavior]

## Data Model Changes

<!--
Fill out only if a Zustand store or TypeScript type changes. Otherwise write: None.
-->

**Store:** `src/stores/<feature>-store.ts`

```ts
// New field / changed type
```

**Migration:** Describe any `version` bump and `migrate` function for Zustand `persist`.

## UI / UX Notes

<!--
What the user sees and how they interact. Reference existing -components/ files.
ASCII art or prose — no pixel-perfect specs needed.
-->

## Edge Cases

- **Empty state:** what happens when there is no data yet?
- **Persistence boundary:** what survives a page reload?

## Implementation Notes

<!--
Which files to touch, in rough order. Deviate as needed during implementation.
-->

1. `src/stores/<feature>-store.ts` — add/modify state and actions
2. `src/routes/<feature>/-utils/<feature>-utils.ts` — new helper functions
3. `src/routes/<feature>/-components/<component>.tsx` — UI changes
4. `docs/<feature>.md` — update current-state reference doc after spec is done

## Test Plan

**Unit tests** (`src/routes/<feature>/-utils/__test__/`):

- [ ] Test helper function X with Y input

**Component tests** (`src/routes/<feature>/-components/__test__/`):

- [ ] Renders correctly when [condition]

**Manual verification:**

- [ ] Open `/feature`, do X, verify Y is visible
- [ ] Reload page, verify Z persists

## Open Questions

- [ ] Question 1 — who decides?
