import type { Transaction } from '#/stores/finance-store'

export const EXPENSE_CATEGORIES = [
  'Food',
  'Transport',
  'Shopping',
  'Bills',
  'Entertainment',
  'Health',
  'Other',
] as const

export const INCOME_CATEGORIES = [
  'Salary',
  'Freelance',
  'Investment',
  'Other',
] as const

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number]
export type IncomeCategory = (typeof INCOME_CATEGORIES)[number]
export type FinanceCategory = ExpenseCategory | IncomeCategory

export const CATEGORY_COLORS: Record<
  FinanceCategory,
  { badge: string; chart: string }
> = {
  Food: { badge: 'bg-amber-500/15 text-amber-600 dark:text-amber-400', chart: '#f59e0b' },
  Transport: { badge: 'bg-sky-500/15 text-sky-600 dark:text-sky-400', chart: '#0ea5e9' },
  Shopping: { badge: 'bg-violet-500/15 text-violet-600 dark:text-violet-400', chart: '#8b5cf6' },
  Bills: { badge: 'bg-rose-500/15 text-rose-600 dark:text-rose-400', chart: '#f43f5e' },
  Entertainment: { badge: 'bg-pink-500/15 text-pink-600 dark:text-pink-400', chart: '#ec4899' },
  Health: { badge: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400', chart: '#10b981' },
  Salary: { badge: 'bg-green-500/15 text-green-600 dark:text-green-400', chart: '#22c55e' },
  Freelance: { badge: 'bg-teal-500/15 text-teal-600 dark:text-teal-400', chart: '#14b8a6' },
  Investment: { badge: 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400', chart: '#6366f1' },
  Other: { badge: 'bg-zinc-500/15 text-zinc-600 dark:text-zinc-400', chart: '#71717a' },
}

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
})

export function formatCurrency(amount: number): string {
  return currencyFormatter.format(amount)
}

export function toMonthKey(date: string): string {
  return date.slice(0, 7)
}

export function getCurrentMonthKey(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  return `${year}-${month}`
}

export function formatMonthLabel(monthKey: string): string {
  const [year, month] = monthKey.split('-')
  const date = new Date(Number(year), Number(month) - 1, 1)
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

export function formatTransactionDate(date: string): string {
  return new Date(`${date}T12:00:00`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
}

export function getAvailableMonths(transactions: Transaction[]): string[] {
  const months = new Set<string>([getCurrentMonthKey()])
  for (const tx of transactions) {
    months.add(toMonthKey(tx.date))
  }
  return Array.from(months).sort((a, b) => b.localeCompare(a))
}

export function filterTransactions(
  transactions: Transaction[],
  monthKey: string,
  category: string | null,
): Transaction[] {
  return transactions
    .filter((tx) => toMonthKey(tx.date) === monthKey)
    .filter((tx) => (category ? tx.category === category : true))
    .sort((a, b) => b.date.localeCompare(a.date))
}

export function getTotalBalance(transactions: Transaction[]): number {
  return transactions.reduce((sum, tx) => {
    return tx.type === 'income' ? sum + tx.amount : sum - tx.amount
  }, 0)
}

export function getMonthTotals(
  transactions: Transaction[],
  monthKey: string,
): { income: number; expense: number } {
  let income = 0
  let expense = 0

  for (const tx of transactions) {
    if (toMonthKey(tx.date) !== monthKey) continue
    if (tx.type === 'income') {
      income += tx.amount
    } else {
      expense += tx.amount
    }
  }

  return { income, expense }
}

export interface CategorySpending {
  category: string
  amount: number
  fill: string
}

export function getSpendingByCategory(
  transactions: Transaction[],
  monthKey: string,
): CategorySpending[] {
  const totals = new Map<string, number>()

  for (const tx of transactions) {
    if (tx.type !== 'expense') continue
    if (toMonthKey(tx.date) !== monthKey) continue
    totals.set(tx.category, (totals.get(tx.category) ?? 0) + tx.amount)
  }

  return Array.from(totals.entries())
    .map(([category, amount]) => ({
      category,
      amount,
      fill: CATEGORY_COLORS[category as FinanceCategory].chart,
    }))
    .sort((a, b) => b.amount - a.amount)
}

export function getCategoriesForType(
  type: Transaction['type'],
): readonly FinanceCategory[] {
  return type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES
}
