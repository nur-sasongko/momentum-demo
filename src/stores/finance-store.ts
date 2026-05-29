import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import { getCurrentMonthKey } from '#/lib/finance-utils'

import type { FinanceCategory } from '#/lib/finance-utils'

export type TransactionType = 'income' | 'expense'

export interface Transaction {
  id: string
  type: TransactionType
  amount: number
  category: FinanceCategory
  date: string
  note: string
}

function daysAgo(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString().slice(0, 10)
}

function dayOfCurrentMonth(day: number): string {
  const d = new Date()
  d.setDate(day)
  return d.toISOString().slice(0, 10)
}

export const SEED_TRANSACTIONS: Transaction[] = [
  {
    id: 'tx-salary',
    type: 'income',
    amount: 4200,
    category: 'Salary',
    date: dayOfCurrentMonth(1),
    note: 'Monthly salary',
  },
  {
    id: 'tx-rent',
    type: 'expense',
    amount: 1200,
    category: 'Bills',
    date: dayOfCurrentMonth(2),
    note: 'Rent payment',
  },
  {
    id: 'tx-groceries-1',
    type: 'expense',
    amount: 86.5,
    category: 'Food',
    date: daysAgo(2),
    note: 'Weekly groceries',
  },
  {
    id: 'tx-uber',
    type: 'expense',
    amount: 24.75,
    category: 'Transport',
    date: daysAgo(3),
    note: 'Ride to office',
  },
  {
    id: 'tx-streaming',
    type: 'expense',
    amount: 15.99,
    category: 'Entertainment',
    date: daysAgo(5),
    note: 'Streaming subscription',
  },
  {
    id: 'tx-freelance',
    type: 'income',
    amount: 650,
    category: 'Freelance',
    date: daysAgo(7),
    note: 'Design project milestone',
  },
  {
    id: 'tx-shopping',
    type: 'expense',
    amount: 142.3,
    category: 'Shopping',
    date: daysAgo(8),
    note: 'Home essentials',
  },
  {
    id: 'tx-gym',
    type: 'expense',
    amount: 49,
    category: 'Health',
    date: daysAgo(10),
    note: 'Gym membership',
  },
  {
    id: 'tx-coffee',
    type: 'expense',
    amount: 12.4,
    category: 'Food',
    date: daysAgo(1),
    note: 'Coffee with friends',
  },
  {
    id: 'tx-utilities',
    type: 'expense',
    amount: 98.2,
    category: 'Bills',
    date: daysAgo(12),
    note: 'Electricity bill',
  },
  {
    id: 'tx-prev-salary',
    type: 'income',
    amount: 4200,
    category: 'Salary',
    date: daysAgo(35),
    note: 'Previous month salary',
  },
  {
    id: 'tx-prev-rent',
    type: 'expense',
    amount: 1200,
    category: 'Bills',
    date: daysAgo(33),
    note: 'Previous month rent',
  },
]

export type AddTransactionInput = Omit<Transaction, 'id'>

interface FinanceState {
  transactions: Transaction[]
  selectedMonth: string
  selectedCategory: string | null
  isAddTransactionOpen: boolean
  addTransaction: (input: AddTransactionInput) => void
  deleteTransaction: (id: string) => void
  setSelectedMonth: (monthKey: string) => void
  setSelectedCategory: (category: string | null) => void
  setAddTransactionOpen: (open: boolean) => void
}

export const useFinanceStore = create<FinanceState>()(
  persist(
    (set) => ({
      transactions: SEED_TRANSACTIONS,
      selectedMonth: getCurrentMonthKey(),
      selectedCategory: null,
      isAddTransactionOpen: false,
      addTransaction: (input) =>
        set((state) => ({
          transactions: [
            {
              ...input,
              id: crypto.randomUUID(),
            },
            ...state.transactions,
          ],
          isAddTransactionOpen: false,
        })),
      deleteTransaction: (id) =>
        set((state) => ({
          transactions: state.transactions.filter((tx) => tx.id !== id),
        })),
      setSelectedMonth: (monthKey) => set({ selectedMonth: monthKey }),
      setSelectedCategory: (category) => set({ selectedCategory: category }),
      setAddTransactionOpen: (open) => set({ isAddTransactionOpen: open }),
    }),
    {
      name: 'myspace-finance',
      version: 1,
      partialize: (state) => ({ transactions: state.transactions }),
      onRehydrateStorage: () => (state) => {
        if (state && state.transactions.length === 0) {
          state.transactions = SEED_TRANSACTIONS
        }
        if (state && !state.selectedMonth) {
          state.selectedMonth = getCurrentMonthKey()
        }
      },
    },
  ),
)
