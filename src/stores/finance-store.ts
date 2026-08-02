import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import type { GeoLocation } from '#/types/location'

export type TransactionLocation = GeoLocation

export type TransactionType = 'income' | 'expense'

export interface FinanceCategory {
  id: string
  name: string
  type: TransactionType
  color: string
  isSystem: boolean
  createdAt: string
}

export interface Transaction {
  id: string
  type: TransactionType
  amount: number
  date: string
  note: string
  categoryId: string
  category?: FinanceCategory
  location: TransactionLocation | null
  createdAt: string
  updatedAt: string
}

export interface DateRange {
  from: string | null
  to: string | null
}

interface FinanceState {
  categories: FinanceCategory[]
  isAddTransactionOpen: boolean
  editingTransactionId: string | null
  editingTransaction: Transaction | null
  isBalanceHidden: boolean

  setCategories: (categories: FinanceCategory[]) => void
  addCategory: (cat: FinanceCategory) => void
  updateCategory: (
    id: string,
    patch: Partial<Pick<FinanceCategory, 'name' | 'type' | 'color'>>,
  ) => void
  removeCategory: (id: string) => void

  setAddTransactionOpen: (open: boolean) => void
  setEditingTransactionId: (id: string | null) => void
  setEditingTransaction: (tx: Transaction | null) => void
  setBalanceHidden: (hidden: boolean) => void
}

export const useFinanceStore = create<FinanceState>()(
  persist(
    (set, get) => ({
      categories: [],
      isAddTransactionOpen: false,
      editingTransactionId: null,
      editingTransaction: null,
      isBalanceHidden: false,

      setCategories: (categories) => set({ categories }),
      addCategory: (cat) =>
        set((state) => ({ categories: [...state.categories, cat] })),
      updateCategory: (id, patch) =>
        set((state) => ({
          categories: state.categories.map((c) =>
            c.id === id ? { ...c, ...patch } : c,
          ),
        })),
      removeCategory: (id) =>
        set((state) => ({
          categories: state.categories.filter((c) => c.id !== id),
        })),

      setAddTransactionOpen: (open) =>
        set({
          isAddTransactionOpen: open,
          editingTransactionId: open ? get().editingTransactionId : null,
          editingTransaction: open ? get().editingTransaction : null,
        }),
      setEditingTransactionId: (id) =>
        set({ editingTransactionId: id, isAddTransactionOpen: id !== null }),
      setEditingTransaction: (tx) =>
        set({
          editingTransaction: tx,
          editingTransactionId: tx?.id ?? null,
          isAddTransactionOpen: tx !== null,
        }),
      setBalanceHidden: (hidden) => set({ isBalanceHidden: hidden }),
    }),
    {
      name: 'myspace-finance',
      version: 5,
      partialize: (state) => ({
        isBalanceHidden: state.isBalanceHidden,
      }),
    },
  ),
)
