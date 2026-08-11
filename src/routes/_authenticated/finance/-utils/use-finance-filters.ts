import { getRouteApi } from '@tanstack/react-router'

import { useFinanceStore } from '#/stores/finance-store'
import { toggleArrayValue } from '#/utils/search-params'
import { FINANCE_ROUTE_ID } from './finance-search'

import type { DateRange, TransactionType } from '#/stores/finance-store'
import type { FinanceSearch, FinanceView } from './finance-search'
import type { FinanceFiltersPatch } from '../-types/finance-query'

const routeApi = getRouteApi(FINANCE_ROUTE_ID)

function toSearchPatch(patch: FinanceFiltersPatch): Partial<FinanceSearch> {
  const next: Partial<FinanceSearch> = {}
  if (patch.view !== undefined) next.view = patch.view
  if (patch.dateRange !== undefined) {
    next.from = patch.dateRange.from ?? undefined
    next.to = patch.dateRange.to ?? undefined
  }
  if (patch.selectedType !== undefined)
    next.type = patch.selectedType ?? undefined
  if (patch.selectedCategories !== undefined)
    next.cat = patch.selectedCategories
  if (patch.selectedCities !== undefined) next.city = patch.selectedCities
  return next
}

/**
 * Reads/writes finance filter state from the URL (spec 11), exposing the same
 * field and action names the old `useFinanceStore` filter slice used, so
 * migrating a component is a one-line hook swap.
 */
export function useFinanceFilters() {
  const search = routeApi.useSearch()
  const navigate = routeApi.useNavigate()
  const categories = useFinanceStore((s) => s.categories)

  const dateRange: DateRange = {
    from: search.from ?? null,
    to: search.to ?? null,
  }
  const selectedType: TransactionType | null = search.type ?? null
  const selectedCategories = search.cat
  const selectedCities = search.city
  const activeView = search.view

  const activeFilterCount =
    (selectedType ? 1 : 0) + selectedCategories.length + selectedCities.length

  function apply(patch: Partial<FinanceSearch>, opts?: { replace?: boolean }) {
    void navigate({
      search: (prev) => ({ ...prev, ...patch }),
      replace: opts?.replace ?? false,
      resetScroll: false,
    })
  }

  function setDateRange(range: DateRange) {
    if (range.from === dateRange.from && range.to === dateRange.to) return
    apply({ from: range.from ?? undefined, to: range.to ?? undefined })
  }

  // Narrowing the type drops any category selection that no longer belongs
  // to it, in the same navigation — otherwise the table would return no rows.
  function setSelectedType(type: TransactionType | null) {
    const prunedCategories = type
      ? selectedCategories.filter(
          (id) => categories.find((c) => c.id === id)?.type === type,
        )
      : selectedCategories
    apply({ type: type ?? undefined, cat: prunedCategories })
  }

  function toggleCategory(categoryId: string) {
    const { next, isBoundary } = toggleArrayValue(
      selectedCategories,
      categoryId,
    )
    apply({ cat: next }, { replace: !isBoundary })
  }

  function toggleCity(city: string) {
    const { next, isBoundary } = toggleArrayValue(selectedCities, city)
    apply({ city: next }, { replace: !isBoundary })
  }

  function clearTransactionFilters() {
    apply({ type: undefined, cat: [], city: [] })
  }

  function setActiveView(view: FinanceView) {
    apply({ view })
  }

  function setFilters(patch: FinanceFiltersPatch) {
    apply(toSearchPatch(patch))
  }

  return {
    dateRange,
    selectedType,
    selectedCategories,
    selectedCities,
    activeView,
    activeFilterCount,
    setDateRange,
    setSelectedType,
    toggleCategory,
    toggleCity,
    clearTransactionFilters,
    setActiveView,
    setFilters,
  }
}
