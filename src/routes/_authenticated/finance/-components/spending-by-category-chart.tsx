'use client'

import type { TooltipProps } from 'recharts'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

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
  getSpendingByCategory,
} from '../-utils/finance-utils'

function CategoryTooltip({
  active,
  payload,
  label,
}: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 shadow-md">
      <p className="text-sm font-semibold text-popover-foreground">{label}</p>
      <p className="text-sm text-muted-foreground">
        {formatCurrency(payload[0].value ?? 0)}
      </p>
    </div>
  )
}

export function SpendingByCategoryChart() {
  const dateRange = useFinanceStore((s) => s.dateRange)
  const categories = useFinanceStore((s) => s.categories)
  const { data: aggregateRows = [] } = useFinanceAggregateQuery()

  const data = getSpendingByCategory(aggregateRows, dateRange, categories)

  return (
    <Card className="gap-4 py-5">
      <CardHeader className="px-5 pb-0">
        <CardTitle className="text-base">Spending by category</CardTitle>
        <CardDescription>
          Expenses — {formatDateRangeLabel(dateRange.from, dateRange.to)}
        </CardDescription>
      </CardHeader>
      <CardContent className="px-5">
        {data.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">
            No expenses recorded for this period.
          </p>
        ) : (
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height={256}>
              <BarChart
                data={data}
                margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  className="stroke-border"
                />
                <XAxis
                  dataKey="category"
                  tick={{ fontSize: 12 }}
                  className="text-muted-foreground"
                />
                <YAxis
                  tick={{ fontSize: 12 }}
                  tickFormatter={(value: number) =>
                    value >= 1000
                      ? `${(value / 1000).toFixed(1)}k`
                      : String(value)
                  }
                  className="text-muted-foreground"
                />
                <Tooltip
                  content={<CategoryTooltip />}
                  cursor={{ fill: 'hsl(var(--muted))', opacity: 0.4 }}
                />
                <Bar dataKey="amount" radius={[4, 4, 0, 0]}>
                  {data.map((entry) => (
                    <Cell key={entry.category} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
