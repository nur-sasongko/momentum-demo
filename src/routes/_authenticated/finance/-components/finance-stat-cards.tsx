import { Eye, EyeOff, TrendingDown, TrendingUp, Wallet } from 'lucide-react'
import type { KeyboardEvent, ReactNode } from 'react'
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
} from '#/components/ui/card'
import { cn } from '#/libs/utils'
import { useFinanceStore } from '#/stores/finance-store'
import { useFinanceAggregateQuery } from '../-utils/finance-queries'
import {
  formatCurrency,
  formatDateRangeLabel,
  getDateRangeTotals,
  getTotalBalance,
} from '../-utils/finance-utils'

const MASKED_AMOUNT = '••••••'

interface StatCardConfig {
  key: string
  description: ReactNode
  value: number
  icon?: ReactNode
  valueClassName?: string
}

export function FinanceStatCards() {
  const dateRange = useFinanceStore((s) => s.dateRange)
  const isBalanceHidden = useFinanceStore((s) => s.isBalanceHidden)
  const setBalanceHidden = useFinanceStore((s) => s.setBalanceHidden)
  const { data: aggregateRows = [] } = useFinanceAggregateQuery()

  const balance = getTotalBalance(aggregateRows)
  const { income, expense } = getDateRangeTotals(aggregateRows, dateRange)

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

  const rangeLabel = formatDateRangeLabel(dateRange.from, dateRange.to)

  const stats: Array<StatCardConfig> = [
    {
      key: 'balance',
      description: (
        <span className="flex items-center gap-1.5">
          <Wallet className="size-3.5" />
          Total balance
        </span>
      ),
      value: balance,
    },
    {
      key: 'income',
      description: `Income — ${rangeLabel}`,
      value: income,
      icon: <TrendingUp className="size-4 shrink-0" />,
      valueClassName: 'text-emerald-600 dark:text-emerald-400',
    },
    {
      key: 'expense',
      description: `Expenses — ${rangeLabel}`,
      value: expense,
      icon: <TrendingDown className="size-4 shrink-0" />,
      valueClassName: 'text-rose-600 dark:text-rose-400',
    },
  ]

  return (
    <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-1 [scrollbar-width:none] sm:grid sm:grid-cols-3 sm:gap-4 sm:overflow-visible [&::-webkit-scrollbar]:hidden">
      {stats.map((stat) => (
        <Card
          key={stat.key}
          role="button"
          tabIndex={0}
          onClick={toggleBalance}
          onKeyDown={handleCardKeyDown}
          aria-pressed={isBalanceHidden}
          aria-label={isBalanceHidden ? 'Show balance' : 'Hide balance'}
          className="hover:bg-accent/50 w-[85%] shrink-0 snap-start cursor-pointer gap-4 py-5 transition-colors sm:w-auto"
        >
          <CardHeader className="px-5 pb-0">
            <div className="flex items-center justify-between">
              <CardDescription className="flex items-center gap-1.5">
                {stat.description}
              </CardDescription>
              {visibilityIcon}
            </div>
            <CardTitle
              className={cn(
                'flex items-center gap-1.5 text-2xl tracking-tight',
                stat.valueClassName,
              )}
            >
              {stat.icon}
              {display(stat.value)}
            </CardTitle>
          </CardHeader>
        </Card>
      ))}
    </div>
  )
}
