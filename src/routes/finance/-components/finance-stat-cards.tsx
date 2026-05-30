import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '#/components/ui/card'
import {
  formatCurrency,
  getMonthTotals,
  getTotalBalance,
} from '../-utils/finance-utils'
import { formatMonthLabel } from '#/utils/date'
import { useFinanceStore } from '#/stores/finance-store'

export function FinanceStatCards() {
  const transactions = useFinanceStore((s) => s.transactions)
  const selectedMonth = useFinanceStore((s) => s.selectedMonth)

  const balance = getTotalBalance(transactions)
  const { income, expense } = getMonthTotals(transactions, selectedMonth)
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
        <CardContent className="px-5">
          <p className="text-xs text-muted-foreground">
            All-time income minus expenses
          </p>
        </CardContent>
      </Card>

      <Card className="gap-4 py-5">
        <CardHeader className="px-5 pb-0">
          <CardDescription>
            Income vs expense — {formatMonthLabel(selectedMonth)}
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
            Net this month:{' '}
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
