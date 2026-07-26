import { useState } from 'react'
import type { TooltipContentProps } from 'recharts'
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
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '#/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#/components/ui/select'
import { useFinanceStore } from '#/stores/finance-store'
import { useFinanceAggregateQuery } from '../-utils/finance-queries'
import {
  formatCurrency,
  formatDateRangeLabel,
  getSpendingByCity,
  getSpendingByCountry,
} from '../-utils/finance-utils'

type LocationGrouping = 'city' | 'country'

function LocationTooltip({ active, payload, label }: TooltipContentProps) {
  if (!active || payload.length === 0) return null

  const value = payload[0].value
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 shadow-md">
      <p className="text-sm font-semibold text-popover-foreground">{label}</p>
      <p className="text-sm text-muted-foreground">
        {formatCurrency(typeof value === 'number' ? value : Number(value))}
      </p>
    </div>
  )
}

export function SpendingByLocationChart() {
  const [grouping, setGrouping] = useState<LocationGrouping>('city')
  const dateRange = useFinanceStore((s) => s.dateRange)
  const { data: aggregateRows = [] } = useFinanceAggregateQuery()

  const data =
    grouping === 'city'
      ? getSpendingByCity(aggregateRows, dateRange)
      : getSpendingByCountry(aggregateRows, dateRange)

  return (
    <Card className="gap-4 py-5">
      <CardHeader className="px-5 pb-0">
        <CardTitle className="text-base">Spending by location</CardTitle>
        <CardDescription>
          Expenses — {formatDateRangeLabel(dateRange.from, dateRange.to)}
        </CardDescription>
        <CardAction>
          <Select
            value={grouping}
            onValueChange={(value) => setGrouping(value as LocationGrouping)}
          >
            <SelectTrigger className="w-28" size="sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="city">City</SelectItem>
              <SelectItem value="country">Country</SelectItem>
            </SelectContent>
          </Select>
        </CardAction>
      </CardHeader>
      <CardContent className="px-5">
        {data.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">
            No expenses with a location recorded for this period.
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
                  dataKey="location"
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
                  content={(props) => <LocationTooltip {...props} />}
                  cursor={{ fill: 'hsl(var(--muted))', opacity: 0.4 }}
                />
                <Bar dataKey="amount" radius={[4, 4, 0, 0]}>
                  {data.map((entry) => (
                    <Cell key={entry.location} fill={entry.fill} />
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
