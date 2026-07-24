import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '#/components/ui/card'
import { useFinanceStore } from '#/stores/finance-store'
import { useFinanceAggregateQuery } from '../-utils/finance-queries'
import {
  formatCurrency,
  formatDateRangeLabel,
  getDateRangeTotals,
  getTotalBalance,
} from '../-utils/finance-utils'

export function FinanceStatCards() {
  const dateRange = useFinanceStore((s) => s.dateRange)
  const { data: aggregateRows = [] } = useFinanceAggregateQuery()

  const balance = getTotalBalance(aggregateRows)
  const { income, expense } = getDateRangeTotals(aggregateRows, dateRange)
  const net = income - expense

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Card className="gap-4 py-5">
        <CardHeader className="px-5 pb-0">
          <CardDescription>Total balance</CardDescription>
          <CardTitle className="text-2xl tracking-tight">
            {formatCurrency(balance)}
          </CardTitle>
        </CardHeader>
      </Card>

      <Card className="gap-4 py-5">
        <CardHeader className="px-5 pb-0">
          <CardDescription>
            Income vs expense —{' '}
            {formatDateRangeLabel(dateRange.from, dateRange.to)}
          </CardDescription>
          <CardTitle className="text-2xl tracking-tight">
            <span className="text-emerald-600 dark:text-emerald-400">
              {formatCurrency(income)}
            </span>
            <span className="mx-2 text-muted-foreground">/</span>
            <span className="text-rose-600 dark:text-rose-400">
              {formatCurrency(expense)}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="px-5">
          <p className="text-xs text-muted-foreground">
            Net:{' '}
            <span
              className={
                net >= 0
                  ? 'font-medium text-emerald-600 dark:text-emerald-400'
                  : 'font-medium text-rose-600 dark:text-rose-400'
              }
            >
              {formatCurrency(net)}
            </span>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
