# Habits Module

The Habits module is the daily habit tracker at `/habits`. It focuses on quick day-level check-ins, streak visibility, and low-friction habit creation.

## Goals

- Track whether a habit was completed on a given day.
- Surface daily completion progress at a glance.
- Encourage consistency with streak feedback.
- Keep data local and offline-friendly.

## Source of Truth

- Route entry: `src/routes/habits/index.tsx`
- Habits store: `src/stores/habits-store.ts`
- Habit utilities: `src/routes/habits/-utils/habit-utils.ts`
- Summary panel: `src/routes/habits/-components/habit-summary.tsx`
- Grid and empty state: `src/routes/habits/-components/habit-grid.tsx`
- Habit card: `src/routes/habits/-components/habit-card.tsx`
- Create modal: `src/routes/habits/-components/new-habit-modal.tsx`
- Top bar trigger integration: `src/components/TopBar.tsx`

## Route and Composition

`createFileRoute('/habits/')` is defined in `src/routes/habits/index.tsx`.

The page composes three feature components:

- `HabitSummary` for today's aggregate completion
- `HabitGrid` for all habit cards or empty-state CTA
- `NewHabitModal` for creating new habits

## Data Model

`Habit` in `src/stores/habits-store.ts`:

- `id: string`
- `name: string`
- `icon: string` (emoji)
- `color: HabitColor`
- `history: Record<string, boolean>` keyed by date (`YYYY-MM-DD`)
- `createdAt: string` (ISO timestamp)

`SEED_HABITS` provides starter data and pre-filled histories.

## State and Persistence

State is managed with Zustand + `persist` middleware (`useHabitsStore`).

- Storage key: `myspace-habits`
- Version: `1`
- Persisted slice: `habits` only
- Rehydrate behavior: repopulates from `SEED_HABITS` if persisted list is empty

### Store Actions

- `toggleDay(habitId, dateKey)` flips completion for a specific day
- `addHabit(habitInput)` appends a new habit with generated `id`, empty history, and current timestamp
- `setNewHabitOpen(open)` controls create-modal visibility

## Core Utilities

Defined in `src/routes/habits/-utils/habit-utils.ts`:

- `toDateKey(offsetDays)` builds date keys for storage/lookups
- `getLast7Days()` returns date keys + weekday labels for card UI
- `getStreak(history)` computes consecutive completed days from today
- `HABIT_COLORS` and `HABIT_COLOR_CLASSES` drive color token consistency
- `HABIT_EMOJIS` powers icon picker in the create modal

## UI Behavior

### Summary

`HabitSummary` computes:

- `completed` = habits with `history[today] === true`
- `total` = number of habits
- `percent` = progress bar value

### Habit Card

Each card shows:

- Emoji + habit name
- Current streak count
- Seven day toggles with keyboard/button semantics
- Color-aware visual accents derived from selected habit color

### Empty State

When no habits exist, `HabitGrid` shows a centered empty state and CTA to open the creation modal.

### New Habit Modal

`NewHabitModal` uses:

- `react-hook-form`
- `zod` schema validation
- Emoji selector
- Color selector

On submit, it calls `addHabit` and resets form defaults.

## Shell Integration

The shared top bar exposes a quick-add button only on `/habits`:

- `TopBar` checks `pathname === '/habits'`
- Clicking the plus button sets `isNewHabitOpen = true`

This gives users two entry points for creation: top bar and in-grid actions.

## Extending This Module

Recommended next steps:

- Add habit archiving/deletion.
- Add per-habit notes or goal targets.
- Add weekly/monthly analytics route powered by current history data.
- Add export/import for backup and cross-device migration.
