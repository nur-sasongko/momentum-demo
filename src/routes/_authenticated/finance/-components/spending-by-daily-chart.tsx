'use client'

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
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
  getDailySpendingByCategory,
} from '../-utils/finance-utils'

import type { DailySpendingPoint } from '../-utils/finance-utils'
import type { TooltipPayloadEntry, TooltipProps } from 'recharts'

function DailyTooltip({
  active,
  payload,
  label,
}: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null
  const point = payload[0]?.payload as DailySpendingPoint | undefined
  const entries = (payload as TooltipPayloadEntry[]).filter(
    (entry) => Number(entry.value ?? 0) > 0,
  )

  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 shadow-md">
      <p className="text-sm font-semibold text-popover-foreground">{label}</p>
      {entries.map((entry) => (
        <p
          key={entry.dataKey as string}
          className="text-sm text-muted-foreground"
        >
          {entry.name}: {formatCurrency(entry.value as number)}
        </p>
      ))}
      {point && (
        <p className="mt-1 text-sm font-semibold text-popover-foreground">
          Total: {formatCurrency(point.total)}
        </p>
      )}
    </div>
  )
}

export function SpendingByDailyChart() {
  const dateRange = useFinanceStore((s) => s.dateRange)
  const categories = useFinanceStore((s) => s.categories)
  const { data: aggregateRows = [] } = useFinanceAggregateQuery()

  const { data, series } = getDailySpendingByCategory(
    aggregateRows,
    dateRange,
    categories,
  )

  return (
    <Card className="gap-4 py-5">
      <CardHeader className="px-5 pb-0">
        <CardTitle className="text-base">Daily spending</CardTitle>
        <CardDescription>
          Expenses by day — {formatDateRangeLabel(dateRange.from, dateRange.to)}
        </CardDescription>
      </CardHeader>
      <CardContent className="px-5">
        {!dateRange.from || !dateRange.to ? (
          <p className="py-12 text-center text-sm text-muted-foreground">
            Pick a date range to see daily spending.
          </p>
        ) : series.length === 0 ? (
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
                  dataKey="dateLabel"
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
                  content={<DailyTooltip />}
                  cursor={{ fill: 'hsl(var(--muted))', opacity: 0.4 }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                {series.map((s, index) => (
                  <Bar
                    key={s.key}
                    dataKey={s.key}
                    name={s.name}
                    stackId="day"
                    fill={s.color}
                    radius={
                      index === series.length - 1 ? [4, 4, 0, 0] : undefined
                    }
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
