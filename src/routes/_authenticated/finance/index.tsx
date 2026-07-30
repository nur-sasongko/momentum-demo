import { createFileRoute } from '@tanstack/react-router'
import { PieChart, Table } from 'lucide-react'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '#/components/ui/tabs'
import { FinanceEmptyState } from '#/routes/_authenticated/finance/-components/finance-empty-state'
import { FinanceFilters } from '#/routes/_authenticated/finance/-components/finance-filters'
import { FinanceStatCards } from '#/routes/_authenticated/finance/-components/finance-stat-cards'
import { SpendingByCategoryChart } from '#/routes/_authenticated/finance/-components/spending-by-category-chart'
import { SpendingByDailyChart } from '#/routes/_authenticated/finance/-components/spending-by-daily-chart'
import { SpendingByLocationChart } from '#/routes/_authenticated/finance/-components/spending-by-location-chart'
import { TransactionFormSheet } from '#/routes/_authenticated/finance/-components/transaction-form'
import { TransactionsTable } from '#/routes/_authenticated/finance/-components/transactions-table'
import { useFinanceStore } from '#/stores/finance-store'
import type { FinanceView } from '#/stores/finance-store'
import {
  useFinanceAggregateQuery,
  useFinanceCategoriesQuery,
} from './-utils/finance-queries'
import { hasLocationData } from './-utils/finance-utils'

export const Route = createFileRoute('/_authenticated/finance/')({
  head: () => ({
    meta: [{ title: 'Finance — Momentum' }],
  }),
  component: FinancePage,
})

function FinancePage() {
  const { isLoading: catsLoading } = useFinanceCategoriesQuery()
  const { data: aggregateRows = [], isLoading: aggLoading } =
    useFinanceAggregateQuery()
  const activeView = useFinanceStore((s) => s.activeView)
  const setActiveView = useFinanceStore((s) => s.setActiveView)

  const isLoading = catsLoading || aggLoading

  if (isLoading) {
    return (
      <div className="route-fade-in p-4 md:p-6">
        <div className="space-y-6">
          <div>
            <div className="h-7 w-40 animate-pulse rounded-md bg-muted" />
            <div className="mt-1.5 h-4 w-72 animate-pulse rounded-md bg-muted" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="h-32 animate-pulse rounded-xl bg-muted" />
            <div className="h-32 animate-pulse rounded-xl bg-muted" />
          </div>
          <div className="h-72 animate-pulse rounded-xl bg-muted" />
        </div>
      </div>
    )
  }

  const hasTransactions = aggregateRows.length > 0

  return (
    <div className="route-fade-in space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Finance Tracker
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Track income, expenses, and spending by category.
        </p>
      </div>

      <FinanceFilters />
      <FinanceStatCards />

      {hasTransactions ? (
        <Tabs
          value={activeView}
          onValueChange={(v) => setActiveView(v as FinanceView)}
          className="space-y-4"
        >
          <TabsList>
            <TabsTrigger value="chart">
              <PieChart />
              Chart
            </TabsTrigger>
            <TabsTrigger value="table">
              <Table />
              Table
            </TabsTrigger>
          </TabsList>
          <TabsContent value="chart" className="space-y-4">
            <SpendingByCategoryChart />
            <SpendingByDailyChart />
            {hasLocationData(aggregateRows) && <SpendingByLocationChart />}
          </TabsContent>
          <TabsContent value="table">
            <TransactionsTable />
          </TabsContent>
        </Tabs>
      ) : (
        <FinanceEmptyState />
      )}

      <TransactionFormSheet />
    </div>
  )
}
