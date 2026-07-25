import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { toast } from 'sonner'

import { getSupabaseBrowserClient } from '#/libs/supabase/client'
import { useFinanceStore } from '#/stores/finance-store'
import { DEFAULT_CATEGORY_CONFIGS } from './finance-utils'

import type { AggregateRow } from './finance-utils'
import type { FinanceCategory, Transaction } from '#/stores/finance-store'

// ---------------------------------------------------------------------------
// Query key factory
// ---------------------------------------------------------------------------

export const FINANCE_KEYS = {
  categories: ['finance', 'categories'] as const,
  aggregate: ['finance', 'aggregate'] as const,
  transactions: (params: TransactionQueryParams) =>
    ['finance', 'transactions', params] as const,
}

// ---------------------------------------------------------------------------
// Transformers
// ---------------------------------------------------------------------------

function transformCategory(row: Record<string, unknown>): FinanceCategory {
  return {
    id: row.id as string,
    name: row.name as string,
    type: row.type as 'income' | 'expense',
    color: row.color as string,
    isSystem: row.is_system as boolean,
    createdAt: row.created_at as string,
  }
}

function transformTransaction(
  row: Record<string, unknown>,
  categories: FinanceCategory[],
): Transaction {
  const category = categories.find((c) => c.id === row.category_id)
  return {
    id: row.id as string,
    type: row.type as 'income' | 'expense',
    amount: Number(row.amount),
    date: row.date as string,
    note: (row.note as string | null) ?? '',
    categoryId: row.category_id as string,
    category,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  }
}

// ---------------------------------------------------------------------------
// 1. Categories query  (fetches + seeds, stores in Zustand)
// ---------------------------------------------------------------------------

export function useFinanceCategoriesQuery() {
  const setCategories = useFinanceStore((s) => s.setCategories)

  return useQuery({
    queryKey: FINANCE_KEYS.categories,
    queryFn: async () => {
      const supabase = getSupabaseBrowserClient()
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()
      if (userError || !user) throw new Error('Not authenticated')

      const { data: initialRows, error: catError } = await supabase
        .from('finance_categories')
        .select('*')
        .order('created_at', { ascending: true })

      if (catError) throw catError

      let catRows = initialRows

      if (catRows.length === 0) {
        const defaults = DEFAULT_CATEGORY_CONFIGS.map((c) => ({
          user_id: user.id,
          name: c.name,
          type: c.type,
          color: c.color,
          is_system: c.isSystem,
        }))
        const { data: seeded, error: seedError } = await supabase
          .from('finance_categories')
          .insert(defaults)
          .select()
        if (seedError) throw seedError
        catRows = seeded
      }

      const categories = catRows.map(transformCategory)
      setCategories(categories)
      return categories
    },
    staleTime: 5 * 60 * 1000,
  })
}

// ---------------------------------------------------------------------------
// 2. Aggregate query  (lightweight rows for charts + stat cards)
//    Fetches ALL transactions — only amount, type, date, category_id.
//    No pagination. Components filter by dateRange client-side.
// ---------------------------------------------------------------------------

export function useFinanceAggregateQuery() {
  return useQuery({
    queryKey: FINANCE_KEYS.aggregate,
    queryFn: async (): Promise<AggregateRow[]> => {
      const supabase = getSupabaseBrowserClient()
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()
      if (userError || !user) throw new Error('Not authenticated')

      const { data, error } = await supabase
        .from('finance_transactions')
        .select('amount, type, date, category_id')

      if (error) throw error
      return data
    },
    staleTime: 30 * 1000,
  })
}

// ---------------------------------------------------------------------------
// 3. Paginated transactions query  (for the table)
// ---------------------------------------------------------------------------

export interface TransactionQueryParams {
  page: number
  pageSize: number
  dateFrom: string | null
  dateTo: string | null
  type: 'income' | 'expense' | null
  categoryId: string | null
}

export interface TransactionPage {
  data: Transaction[]
  count: number
}

export function useTransactionsQuery(params: TransactionQueryParams) {
  return useQuery({
    queryKey: FINANCE_KEYS.transactions(params),
    queryFn: async (): Promise<TransactionPage> => {
      const supabase = getSupabaseBrowserClient()
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()
      if (userError || !user) throw new Error('Not authenticated')

      const from = params.page * params.pageSize
      const to = from + params.pageSize - 1

      let q = supabase
        .from('finance_transactions')
        .select('*', { count: 'exact' })
        .order('date', { ascending: false })
        .order('created_at', { ascending: false })
        .range(from, to)

      if (params.dateFrom) q = q.gte('date', params.dateFrom)
      if (params.dateTo) q = q.lte('date', params.dateTo)
      if (params.type) q = q.eq('type', params.type)
      if (params.categoryId) q = q.eq('category_id', params.categoryId)

      const { data, count, error } = await q
      if (error) throw error

      const categories = useFinanceStore.getState().categories
      const transactions = data.map((row) =>
        transformTransaction(row as Record<string, unknown>, categories),
      )

      return { data: transactions, count: count ?? 0 }
    },
    placeholderData: keepPreviousData,
    staleTime: 30 * 1000,
  })
}

// ---------------------------------------------------------------------------
// Mutations — invalidate both aggregate + transactions on every change
// ---------------------------------------------------------------------------

function invalidateAll(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: FINANCE_KEYS.aggregate })
  queryClient.invalidateQueries({ queryKey: ['finance', 'transactions'] })
}

export function useCreateTransactionMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: {
      type: 'income' | 'expense'
      amount: number
      date: string
      note: string
      categoryId: string
    }) => {
      const supabase = getSupabaseBrowserClient()
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()
      if (userError || !user) throw new Error('Not authenticated')

      const { data, error } = await supabase
        .from('finance_transactions')
        .insert([
          {
            user_id: user.id,
            category_id: input.categoryId,
            type: input.type,
            amount: input.amount,
            date: input.date,
            note: input.note || null,
          },
        ])
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      invalidateAll(queryClient)
    },
    onError: () => {
      toast.error('Failed to save transaction.')
    },
  })
}

export function useUpdateTransactionMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      id,
      input,
    }: {
      id: string
      input: {
        type: 'income' | 'expense'
        amount: number
        date: string
        note: string
        categoryId: string
      }
    }) => {
      const supabase = getSupabaseBrowserClient()
      const { error } = await supabase
        .from('finance_transactions')
        .update({
          category_id: input.categoryId,
          type: input.type,
          amount: input.amount,
          date: input.date,
          note: input.note || null,
        })
        .eq('id', id)

      if (error) throw error
    },
    onSuccess: () => {
      invalidateAll(queryClient)
    },
    onError: () => {
      toast.error('Failed to update transaction.')
    },
  })
}

export function useDeleteTransactionMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const supabase = getSupabaseBrowserClient()
      const { error } = await supabase
        .from('finance_transactions')
        .delete()
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      invalidateAll(queryClient)
    },
    onError: () => {
      toast.error('Failed to delete transaction.')
    },
  })
}

export function useCreateCategoryMutation() {
  const queryClient = useQueryClient()
  const addCategory = useFinanceStore((s) => s.addCategory)

  return useMutation({
    mutationFn: async (input: {
      name: string
      type: 'income' | 'expense'
      color: string
    }) => {
      const supabase = getSupabaseBrowserClient()
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()
      if (userError || !user) throw new Error('Not authenticated')

      const { data, error } = await supabase
        .from('finance_categories')
        .insert([
          {
            user_id: user.id,
            name: input.name,
            type: input.type,
            color: input.color,
            is_system: false,
          },
        ])
        .select()
        .single()

      if (error) throw error
      return transformCategory(data as Record<string, unknown>)
    },
    onSuccess: (newCat) => {
      addCategory(newCat)
      queryClient.invalidateQueries({ queryKey: FINANCE_KEYS.categories })
      invalidateAll(queryClient)
    },
    onError: () => {
      toast.error('Failed to create category.')
    },
  })
}

export function useUpdateCategoryMutation() {
  const queryClient = useQueryClient()
  const updateCategory = useFinanceStore((s) => s.updateCategory)

  return useMutation({
    mutationFn: async (input: {
      id: string
      name: string
      type: 'income' | 'expense'
      color: string
    }) => {
      const supabase = getSupabaseBrowserClient()
      const { data, error } = await supabase
        .from('finance_categories')
        .update({ name: input.name, type: input.type, color: input.color })
        .eq('id', input.id)
        .select()
        .single()

      if (error) throw error
      return transformCategory(data as Record<string, unknown>)
    },
    onSuccess: (updated) => {
      updateCategory(updated.id, updated)
      queryClient.invalidateQueries({ queryKey: FINANCE_KEYS.categories })
      invalidateAll(queryClient)
      toast.success('Category updated.')
    },
    onError: (error: { code?: string }) => {
      if (error.code === '23505') {
        toast.error('A category with that name already exists.')
      } else {
        toast.error('Failed to update category.')
      }
    },
  })
}

export function useDeleteCategoryMutation() {
  const queryClient = useQueryClient()
  const removeCategory = useFinanceStore((s) => s.removeCategory)

  return useMutation({
    mutationFn: async (categoryId: string) => {
      const supabase = getSupabaseBrowserClient()
      const { error } = await supabase
        .from('finance_categories')
        .delete()
        .eq('id', categoryId)
      if (error) throw error
    },
    onSuccess: (_, id) => {
      removeCategory(id)
      queryClient.invalidateQueries({ queryKey: FINANCE_KEYS.categories })
      invalidateAll(queryClient)
      toast.success('Category deleted. Transactions moved to Other.')
    },
    onError: () => {
      toast.error('Failed to delete category.')
    },
  })
}
