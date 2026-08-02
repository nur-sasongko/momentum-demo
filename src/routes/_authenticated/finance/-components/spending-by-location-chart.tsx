import { useState } from 'react'
import type { BarRectangleItem, TooltipContentProps } from 'recharts'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#/components/ui/select'
import {
  CHART_AXIS_TICK,
  CHART_MARGIN,
  CHART_TOOLTIP_CURSOR,
  ChartCard,
  chartYAxisTickFormatter,
} from './chart-card'
import { useFinanceAggregateQuery } from '../-utils/finance-queries'
import {
  formatCurrency,
  formatDateRangeLabel,
  getSpendingByCity,
  getSpendingByCountry,
} from '../-utils/finance-utils'
import { useFinanceFilters } from '../-utils/use-finance-filters'
import {
  selectionFromCityBar,
  selectionFromCountryBar,
} from '../-utils/finance-drilldown'

import type { LocationSpending } from '../-utils/finance-utils'
import type { DrilldownSelection } from '../-utils/finance-drilldown'

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

export function SpendingByLocationChart({
  onSelect,
}: {
  onSelect?: (selection: DrilldownSelection) => void
}) {
  const [grouping, setGrouping] = useState<LocationGrouping>('city')
  const { dateRange } = useFinanceFilters()
  const { data: aggregateRows = [] } = useFinanceAggregateQuery()

  const data =
    grouping === 'city'
      ? getSpendingByCity(aggregateRows, dateRange)
      : getSpendingByCountry(aggregateRows, dateRange)

  function handleBarClick(entry: BarRectangleItem) {
    if (!onSelect) return
    const point = entry.payload as LocationSpending | undefined
    if (!point) return
    onSelect(
      grouping === 'city'
        ? selectionFromCityBar(point)
        : selectionFromCountryBar(point),
    )
  }

  return (
    <ChartCard
      title="Spending by location"
      description={`Expenses — ${formatDateRangeLabel(dateRange.from, dateRange.to)}`}
      hint={onSelect ? 'Click a bar to see transactions' : undefined}
      isEmpty={data.length === 0}
      emptyMessage="No expenses with a location recorded for this period."
      action={
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
      }
    >
      <BarChart data={data} margin={CHART_MARGIN}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
        <XAxis
          dataKey="location"
          tick={CHART_AXIS_TICK}
          className="text-muted-foreground"
        />
        <YAxis
          tick={CHART_AXIS_TICK}
          tickFormatter={chartYAxisTickFormatter}
          className="text-muted-foreground"
        />
        <Tooltip
          content={(props) => <LocationTooltip {...props} />}
          cursor={CHART_TOOLTIP_CURSOR}
        />
        <Bar
          dataKey="amount"
          radius={[4, 4, 0, 0]}
          cursor={onSelect ? 'pointer' : undefined}
          activeBar={onSelect ? { fillOpacity: 0.8 } : false}
          onClick={handleBarClick}
        >
          {data.map((entry) => (
            <Cell key={entry.location} fill={entry.fill} />
          ))}
        </Bar>
      </BarChart>
    </ChartCard>
  )
}
