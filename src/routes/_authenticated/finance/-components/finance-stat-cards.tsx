import { Eye, EyeOff, TrendingDown, TrendingUp, Wallet } from 'lucide-react'
import type { KeyboardEvent } from 'react'
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

const MASKED_AMOUNT = '••••••'

export function FinanceStatCards() {
  const dateRange = useFinanceStore((s) => s.dateRange)
  const isBalanceHidden = useFinanceStore((s) => s.isBalanceHidden)
  const setBalanceHidden = useFinanceStore((s) => s.setBalanceHidden)
  const { data: aggregateRows = [] } = useFinanceAggregateQuery()

  const balance = getTotalBalance(aggregateRows)
  const { income, expense } = getDateRangeTotals(aggregateRows, dateRange)
  const net = income - expense

  const display = (value: number) =>
    isBalanceHidden ? MASKED_AMOUNT : formatCurrency(value)

  const toggleBalance = () => setBalanceHidden(!isBalanceHidden)

  const handleCardKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      toggleBalance()
    }
  }

  const visibilityIcon = isBalanceHidden ? (
    <EyeOff className="text-muted-foreground size-3.5" />
  ) : (
    <Eye className="text-muted-foreground size-3.5" />
  )

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Card
        role="button"
        tabIndex={0}
        onClick={toggleBalance}
        onKeyDown={handleCardKeyDown}
        aria-pressed={isBalanceHidden}
        aria-label={isBalanceHidden ? 'Show balance' : 'Hide balance'}
        className="hover:bg-accent/50 cursor-pointer gap-4 py-5 transition-colors"
      >
        <CardHeader className="px-5 pb-0">
          <div className="flex items-center justify-between">
            <CardDescription className="flex items-center gap-1.5">
              <Wallet className="size-3.5" />
              Total balance
            </CardDescription>
            {visibilityIcon}
          </div>
          <CardTitle className="text-2xl tracking-tight">
            {display(balance)}
          </CardTitle>
        </CardHeader>
      </Card>

      <Card
        role="button"
        tabIndex={0}
        onClick={toggleBalance}
        onKeyDown={handleCardKeyDown}
        aria-pressed={isBalanceHidden}
        aria-label={isBalanceHidden ? 'Show balance' : 'Hide balance'}
        className="hover:bg-accent/50 cursor-pointer gap-4 py-5 transition-colors"
      >
        <CardHeader className="px-5 pb-0">
          <div className="flex items-center justify-between">
            <CardDescription>
              Income vs expense —{' '}
              {formatDateRangeLabel(dateRange.from, dateRange.to)}
            </CardDescription>
            {visibilityIcon}
          </div>
          <CardTitle className="flex flex-col gap-1 text-2xl tracking-tight">
            <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
              <TrendingUp className="size-4 shrink-0" />
              {display(income)}
            </span>
            <span className="flex items-center gap-1.5 text-rose-600 dark:text-rose-400">
              <TrendingDown className="size-4 shrink-0" />
              {display(expense)}
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
              {display(net)}
            </span>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
