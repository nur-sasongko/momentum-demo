---
id: 5
title: 'Finance Supabase Integration'
status: in-progress
feature: finance
created: 2026-07-24
updated: 2026-07-24
---

# Finance Supabase Integration

## Problem Statement

The Finance Tracker stores all data in `localStorage` with hard-coded category lists. There is no
user isolation, no server persistence, and categories cannot be customised. The transaction list is a
simple scrollable list with no search, sort, or editing capability — making it hard to audit
finances as the data grows. Users cannot access their data from a different device.

## Goals

- Persist finance data (transactions + categories) per-user in Supabase with full RLS isolation.
- Replace hard-coded category strings with a dynamic, user-managed category list (add/remove).
- Provide a compact, searchable, sortable table for transactions (replaces the simple list).
- Support full CRUD on transactions (create, edit, delete) via a form built with react-hook-form + zod.
- Add an income-vs-expenses comparison chart alongside the existing spending-by-category breakdown.
- Build a generic reusable `<DataTable>` component (`src/components/ui/data-table.tsx`) usable by
  other features.
- Provide a database migration so the schema can be applied to any Supabase project.

## Non-Goals

- Recurring/scheduled transactions.
- Budget limits or alerts.
- Currency conversion or multi-currency support.
- Importing from bank CSV/OFX files.
- Mobile offline support (optimistic updates roll back on error; no persistent queue).

## Acceptance Criteria

- [ ] Given a new authenticated user, when they navigate to `/finance`, then default categories are
      seeded automatically (expense: Food, Transport, Shopping, Bills, Entertainment, Health, Other;
      income: Salary, Freelance, Investment, Other) and the empty state is shown.
- [ ] Given a user on `/finance`, when they click "Add Transaction" and submit a valid form (type,
      amount, category, date, optional note), then the transaction appears in the table immediately
      and is persisted to Supabase.
- [ ] Given a transaction row in the table, when the user clicks the edit action and changes a
      field, then the transaction is updated in Supabase and reflected in the table.
- [ ] Given a transaction row, when the user deletes it, then it is removed from Supabase and the
      table.
- [ ] Given a user opens the Category Manager, when they add a new category (name + type + color),
      then it appears in the category filter and the transaction form's category dropdown.
- [ ] Given a category with existing transactions, when the user deletes it, then those
      transactions are silently reassigned to the same-type "Other" category and the deleted
      category no longer appears in the UI.
- [ ] Given the "Other" category (income or expense), when the user tries to delete it, then the
      delete action is hidden/disabled and the category persists.
- [ ] Given transactions in the table, when the user types in the search box, then rows are filtered
      by note/description in real time without a network request.
- [ ] Given the category filter in the table toolbar, when the user selects a category, then only
      transactions of that category are shown.
- [ ] Given the table, when the user clicks a column header (Date, Category, Amount), then rows are
      sorted by that column; clicking again reverses the sort.
- [ ] Given the selected month, both charts update: the income-vs-expenses chart shows income and
      expense totals side-by-side; the spending-by-category chart shows expense breakdown.
- [ ] Given two different authenticated users, then each sees only their own transactions and
      categories (RLS enforced).
- [ ] Given a page reload after adding data, then all transactions and categories are re-fetched
      from Supabase (no localStorage dependency).

## Data Model Changes

**New Supabase tables (see migrations):**

- `public.finance_categories` — per-user category records with `name`, `type`, `color`, `is_system`.
- `public.finance_transactions` — per-user transactions referencing `finance_categories(id)`.

**Store:** `src/stores/finance-store.ts` — full rewrite.

```ts
export type TransactionType = 'income' | 'expense'

export interface FinanceCategory {
  id: string
  name: string
  type: TransactionType
  color: string // hex color for badge + chart
  isSystem: boolean // true = cannot be deleted
  createdAt: string
}

export interface Transaction {
  id: string
  type: TransactionType
  amount: number
  date: string // YYYY-MM-DD
  note: string
  categoryId: string
  category?: FinanceCategory // hydrated for display
  createdAt: string
  updatedAt: string
}
```

**Persistence:** `localStorage` persistence drops transactions and categories (Supabase is source of
truth). Only `selectedMonth` (UI pref) is persisted locally. Store version bumped to `2`.

**Migrations:**

- `supabase/migrations/20260724000001_create_finance_categories.sql`
- `supabase/migrations/20260724000002_create_finance_transactions.sql` — includes `updated_at`
  trigger and `reassign_transactions_on_category_delete` before-delete trigger.

## UI / UX Notes

```
┌─ Finance Tracker ─────────────────────────────────────────────────────┐
│ [Month ▾] [Category Filter ▾] [Manage Categories] [+ Add Transaction] │
├───────────────────────────────────────────────────────────────────────┤
│  ┌── Total Balance ──┐  ┌── Monthly Income / Expense ──────────────┐  │
│  │     $4,200.00     │  │  +$4,200 / -$1,486   Net: +$2,714        │  │
│  └──────────────────┘  └──────────────────────────────────────────┘  │
├───────────────────────────────────────────────────────────────────────┤
│  ┌── Income vs Expenses ────┐  ┌── Spending by Category ──────────┐  │
│  │  Grouped bar chart       │  │  Bar chart by category           │  │
│  │  (all available months)  │  │  (selected month, expense only)  │  │
│  └─────────────────────────┘  └─────────────────────────────────┘   │
├───────────────────────────────────────────────────────────────────────┤
│  [🔍 Search notes...]         [Category ▾]  [Date ▾]                 │
│  ┌─ Date ──────┬─ Category ──┬─ Note ──────────────────┬─ Amount ──┐ │
│  │ Jul 24      │ 🔵 Food    │ Weekly groceries         │ -$86.50   │ │
│  │ Jul 22      │ 🟢 Salary  │ Monthly salary           │ +$4,200   │ │
│  │ ...         │ ...        │ ...                      │ ...       │ │
│  │             │            │                          │ ✏️ 🗑️     │ │
│  └─────────────┴────────────┴──────────────────────────┴───────────┘ │
└───────────────────────────────────────────────────────────────────────┘
```

- **Add/Edit Transaction** opens in a `Sheet` (right on desktop, bottom drawer on mobile).
  Form fields: type toggle (income/expense), amount, category (dropdown filtered by type), date,
  note. Edit pre-fills all fields.
- **Category Manager** opens in a `Dialog`. Two sections: expense categories, income categories.
  Each row shows a color swatch, name, and delete button (hidden for system categories). "Add
  Category" button at the bottom of each section.
- **Transaction table**: compact rows, color-coded category badge, amount styled green (+) / red (−).
  Column headers for Date, Category, Amount are clickable to sort.

## Edge Cases

- **New user / empty categories:** seeded on first query response; UI shows empty state until user
  adds a transaction.
- **Delete "Other" category:** delete button hidden in Category Manager; DB trigger raises exception
  as belt-and-suspenders.
- **Category in use deleted:** DB trigger reassigns transactions to "Other"; query is invalidated on
  mutation success, causing a refetch that shows the correct state.
- **Network failure on mutation:** optimistic store update rolls back via query invalidation on
  `onError`; a toast error is shown.
- **Search / filter with no results:** table shows an empty state row ("No transactions match.").
- **Reload:** store rehydrates `selectedMonth` from `localStorage`; categories + transactions are
  always fetched fresh from Supabase.

## Implementation Notes

1. `supabase/migrations/` — write the two SQL migration files.
2. `src/stores/finance-store.ts` — full rewrite with new types and actions.
3. `src/routes/_authenticated/finance/-utils/finance-utils.ts` — replace static category constants
   with `DEFAULT_CATEGORY_CONFIGS` for seeding; adapt calc helpers to work with dynamic categories
   and `categoryId`-based transactions.
4. `bunx --bun shadcn@latest add table` → `src/components/ui/table.tsx`.
5. `src/components/ui/data-table.tsx` — generic DataTable on `@tanstack/react-table` with global
   search, column filters, sorting, toolbar slot.
6. `src/routes/_authenticated/finance/-utils/finance-queries.ts` — `useFinanceQuery`,
   `useCreateTransactionMutation`, `useUpdateTransactionMutation`, `useDeleteTransactionMutation`,
   `useCreateCategoryMutation`, `useDeleteCategoryMutation`.
7. `src/routes/_authenticated/finance/-components/transaction-form.tsx` — rhf + zod create/edit form.
8. `src/routes/_authenticated/finance/-components/transactions-table.tsx` — replaces `transaction-list.tsx`;
   uses `<DataTable>`.
9. `src/routes/_authenticated/finance/-components/category-manager.tsx` — Dialog for add/delete.
10. `src/routes/_authenticated/finance/-components/income-expense-chart.tsx` — new Recharts chart.
11. Update `spending-by-category-chart.tsx`, `finance-filters.tsx`, `finance-stat-cards.tsx`.
12. Update `finance/index.tsx` — call `useFinanceQuery`, add loader, wire up components.
13. Remove `transaction-list.tsx` and `add-transaction-sheet.tsx` (folded into above).

## Test Plan

**Unit tests** (`src/routes/_authenticated/finance/-utils/__test__/`):

- [ ] `filterTransactions` returns only transactions for the selected month and category
- [ ] `getMonthTotals` correctly sums income and expense amounts
- [ ] `getTotalBalance` returns income - expense across all transactions
- [ ] `getSpendingByCategory` aggregates expenses by category for the selected month

**Component tests** (`src/routes/_authenticated/finance/-components/__test__/`):

- [ ] `<DataTable>` renders rows, global filter hides non-matching rows, sort arrow toggles
- [ ] `<TransactionForm>` submits correct values; shows validation errors on invalid input
- [ ] `<CategoryManager>` hides delete for system categories; calls delete mutation on confirm

**Manual verification:**

- [ ] New user: navigate to `/finance` → empty state, default categories seeded
- [ ] Add income + expenses → appear in table, stat cards, charts update
- [ ] Edit a transaction → changes reflected immediately
- [ ] Delete a transaction → removed from table
- [ ] Search "grocery" → only matching rows visible
- [ ] Sort by Amount descending → highest amounts first
- [ ] Category filter "Food" → only Food transactions shown
- [ ] Add custom category "Travel" (expense, blue) → appears in form dropdown
- [ ] Delete "Travel" with transactions → transactions move to "Other"
- [ ] "Other" category has no delete button
- [ ] Reload page → all data re-fetched; no localStorage transactions
- [ ] Log in as second user → sees only their data

## Open Questions

- [x] Category delete behavior → **Reassign to "Other"** (decided 2026-07-24)
- [x] Edit scope → **Full CRUD** (decided 2026-07-24)
- [x] Local data on migration → **Fresh start** — Supabase source of truth (decided 2026-07-24)
- [x] Charts → **Both**: income-vs-expenses + spending-by-category (decided 2026-07-24)
