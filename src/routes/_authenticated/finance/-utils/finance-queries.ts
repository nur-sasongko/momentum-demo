import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { toast } from 'sonner'

import { useCurrentUser } from '#/hooks/use-current-user'
import { getSupabaseBrowserClient } from '#/libs/supabase/client'
import { useFinanceStore } from '#/stores/finance-store'
import { endOfDayIso, startOfDayIso } from '#/utils/date'
import { DEFAULT_CATEGORY_CONFIGS } from './finance-utils'

import type {
  AggregateRow,
  FinanceCategoryRow,
  TransactionRow,
} from '../-types/finance-api'
import type {
  CityFilter,
  TransactionPage,
  TransactionQueryParams,
} from '../-types/finance-query'
import type {
  FinanceCategory,
  Transaction,
  TransactionLocation,
} from '#/stores/finance-store'

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

function transformCategory(row: FinanceCategoryRow): FinanceCategory {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    color: row.color,
    isSystem: row.is_system,
    createdAt: row.created_at,
  }
}

function transformTransactionLocation(
  row: TransactionRow,
): Transaction['location'] {
  const { location_place_name, location_address, location_city } = row
  const { location_country, location_maps_url } = row

  if (
    !location_place_name &&
    !location_address &&
    !location_city &&
    !location_country &&
    !location_maps_url
  )
    return null

  return {
    placeName: location_place_name ?? '',
    address: location_address ?? '',
    city: location_city ?? '',
    country: location_country ?? '',
    mapsUrl: location_maps_url ?? '',
  }
}

function transformTransaction(
  row: TransactionRow,
  categories: FinanceCategory[],
): Transaction {
  const category = categories.find((c) => c.id === row.category_id)
  return {
    id: row.id,
    type: row.type,
    amount: Number(row.amount),
    date: row.date,
    note: row.note ?? '',
    categoryId: row.category_id,
    category,
    location: transformTransactionLocation(row),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

// ---------------------------------------------------------------------------
// 1. Categories query  (fetches + seeds, stores in Zustand)
// ---------------------------------------------------------------------------

export function useFinanceCategoriesQuery() {
  const setCategories = useFinanceStore((s) => s.setCategories)
  const user = useCurrentUser()

  return useQuery({
    queryKey: FINANCE_KEYS.categories,
    queryFn: async () => {
      if (!user) throw new Error('Not authenticated')
      const supabase = getSupabaseBrowserClient()

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

      const { data, error } = await supabase
        .from('finance_transactions')
        .select(
          'amount, type, date, category_id, location_city, location_country',
        )

      if (error) throw error
      return data
    },
    staleTime: 30 * 1000,
  })
}

// ---------------------------------------------------------------------------
// 3. Paginated transactions query  (for the table)
// ---------------------------------------------------------------------------

function quoteLocationValue(value: string): string {
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
}

/**
 * Translates selected values for a location column into a PostgREST
 * predicate. `.in()` cannot express NULL, so selections including the "no
 * location" bucket (`''`) fall back to an `or` expression. Rows store either
 * NULL or `''` for an unset location.
 */
export function buildLocationFilter(
  column: 'location_city' | 'location_country',
  values: string[],
): CityFilter {
  if (values.length === 0) return { kind: 'none' }

  const named = values.filter((value) => value !== '')
  const includesUnset = named.length !== values.length

  if (!includesUnset) return { kind: 'in', values: named }

  const clauses = [`${column}.is.null`, `${column}.eq.`]
  if (named.length > 0) {
    clauses.push(`${column}.in.(${named.map(quoteLocationValue).join(',')})`)
  }
  return { kind: 'or', expression: clauses.join(',') }
}

export function buildCityFilter(cities: string[]): CityFilter {
  return buildLocationFilter('location_city', cities)
}

export function useTransactionsQuery(params: TransactionQueryParams) {
  return useQuery({
    queryKey: FINANCE_KEYS.transactions(params),
    queryFn: async (): Promise<TransactionPage> => {
      const supabase = getSupabaseBrowserClient()

      const from = params.page * params.pageSize
      const to = from + params.pageSize - 1

      let q = supabase
        .from('finance_transactions')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .order('date', { ascending: false })
        .range(from, to)

      if (params.dateFrom) q = q.gte('date', startOfDayIso(params.dateFrom))
      if (params.dateTo) q = q.lte('date', endOfDayIso(params.dateTo))
      if (params.type) q = q.eq('type', params.type)
      if (params.categoryIds.length > 0)
        q = q.in('category_id', params.categoryIds)

      const cityFilter = buildLocationFilter('location_city', params.cities)
      if (cityFilter.kind === 'in') q = q.in('location_city', cityFilter.values)
      else if (cityFilter.kind === 'or') q = q.or(cityFilter.expression)

      const countryFilter = buildLocationFilter(
        'location_country',
        params.countries,
      )
      if (countryFilter.kind === 'in')
        q = q.in('location_country', countryFilter.values)
      else if (countryFilter.kind === 'or') q = q.or(countryFilter.expression)

      if (params.search) q = q.ilike('note', `%${params.search}%`)

      const { data, count, error } = await q
      if (error) throw error

      const categories = useFinanceStore.getState().categories
      const transactions = (data as TransactionRow[]).map((row) =>
        transformTransaction(row, categories),
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

function locationToColumns(location: TransactionLocation | null | undefined) {
  return {
    location_place_name: location?.placeName || null,
    location_address: location?.address || null,
    location_city: location?.city || null,
    location_country: location?.country || null,
    location_maps_url: location?.mapsUrl || null,
  }
}

function invalidateAll(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: FINANCE_KEYS.aggregate })
  queryClient.invalidateQueries({ queryKey: ['finance', 'transactions'] })
}

export function useCreateTransactionMutation() {
  const queryClient = useQueryClient()
  const user = useCurrentUser()

  return useMutation({
    mutationFn: async (input: {
      type: 'income' | 'expense'
      amount: number
      date: string
      note: string
      categoryId: string
      location?: TransactionLocation | null
    }) => {
      if (!user) throw new Error('Not authenticated')
      const supabase = getSupabaseBrowserClient()

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
            ...locationToColumns(input.location),
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
        location?: TransactionLocation | null
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
          ...locationToColumns(input.location),
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
  const user = useCurrentUser()

  return useMutation({
    mutationFn: async (input: {
      name: string
      type: 'income' | 'expense'
      color: string
    }) => {
      if (!user) throw new Error('Not authenticated')
      const supabase = getSupabaseBrowserClient()

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
      return transformCategory(data as FinanceCategoryRow)
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
      return transformCategory(data as FinanceCategoryRow)
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
