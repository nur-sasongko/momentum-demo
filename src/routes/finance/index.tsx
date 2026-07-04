import { createFileRoute } from '@tanstack/react-router'

import { AddTransactionSheet } from '#/routes/finance/-components/add-transaction-sheet'
import { FinanceEmptyState } from '#/routes/finance/-components/finance-empty-state'
import { FinanceFilters } from '#/routes/finance/-components/finance-filters'
import { FinanceStatCards } from '#/routes/finance/-components/finance-stat-cards'
import { SpendingByCategoryChart } from '#/routes/finance/-components/spending-by-category-chart'
import { TransactionList } from '#/routes/finance/-components/transaction-list'
import { useFinanceStore } from '#/stores/finance-store'

export const Route = createFileRoute('/finance/')({
  head: () => ({
    meta: [{ title: 'Finance — Momentum' }],
  }),
  component: FinancePage,
})

function FinancePage() {
  const transactions = useFinanceStore((s) => s.transactions)

  if (transactions.length === 0) {
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
        <FinanceEmptyState />
        <AddTransactionSheet />
      </div>
    )
  }

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
      <SpendingByCategoryChart />
      <TransactionList />
      <AddTransactionSheet />
    </div>
  )
}
