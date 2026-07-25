import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type TransactionType = 'income' | 'expense'
export type FinanceView = 'chart' | 'transactions'

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
  createdAt: string
  updatedAt: string
}

export interface DateRange {
  from: string | null
  to: string | null
}

interface FinanceState {
  categories: FinanceCategory[]
  dateRange: DateRange
  selectedType: TransactionType | null
  selectedCategory: string | null
  isAddTransactionOpen: boolean
  editingTransactionId: string | null
  editingTransaction: Transaction | null
  isBalanceHidden: boolean
  activeView: FinanceView

  setCategories: (categories: FinanceCategory[]) => void
  addCategory: (cat: FinanceCategory) => void
  updateCategory: (
    id: string,
    patch: Partial<Pick<FinanceCategory, 'name' | 'type' | 'color'>>,
  ) => void
  removeCategory: (id: string) => void

  setDateRange: (range: DateRange) => void
  setSelectedType: (type: TransactionType | null) => void
  setSelectedCategory: (categoryId: string | null) => void
  setAddTransactionOpen: (open: boolean) => void
  setEditingTransactionId: (id: string | null) => void
  setEditingTransaction: (tx: Transaction | null) => void
  setBalanceHidden: (hidden: boolean) => void
  setActiveView: (view: FinanceView) => void
}

export const useFinanceStore = create<FinanceState>()(
  persist(
    (set, get) => ({
      categories: [],
      dateRange: { from: null, to: null },
      selectedType: null,
      selectedCategory: null,
      isAddTransactionOpen: false,
      editingTransactionId: null,
      editingTransaction: null,
      isBalanceHidden: false,
      activeView: 'chart',

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

      setDateRange: (range) => set({ dateRange: range }),
      setSelectedType: (type) => set({ selectedType: type }),
      setSelectedCategory: (categoryId) =>
        set({ selectedCategory: categoryId }),
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
      setActiveView: (view) => set({ activeView: view }),
    }),
    {
      name: 'myspace-finance',
      version: 5,
      partialize: (state) => ({
        isBalanceHidden: state.isBalanceHidden,
        activeView: state.activeView,
      }),
    },
  ),
)
