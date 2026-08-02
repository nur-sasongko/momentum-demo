'use client'

import type { BarRectangleItem, TooltipProps } from 'recharts'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import { useFinanceStore } from '#/stores/finance-store'
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
  getSpendingByCategory,
} from '../-utils/finance-utils'
import { useFinanceFilters } from '../-utils/use-finance-filters'
import { selectionFromCategoryBar } from '../-utils/finance-drilldown'

import type { CategorySpending } from '../-utils/finance-utils'
import type { DrilldownSelection } from '../-utils/finance-drilldown'

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

export function SpendingByCategoryChart({
  onSelect,
}: {
  onSelect?: (selection: DrilldownSelection) => void
}) {
  const { dateRange } = useFinanceFilters()
  const categories = useFinanceStore((s) => s.categories)
  const { data: aggregateRows = [] } = useFinanceAggregateQuery()

  const data = getSpendingByCategory(aggregateRows, dateRange, categories)

  function handleBarClick(entry: BarRectangleItem) {
    if (!onSelect) return
    const point = entry.payload as CategorySpending | undefined
    if (!point) return
    onSelect(selectionFromCategoryBar(point))
  }

  return (
    <ChartCard
      title="Spending by category"
      description={`Expenses — ${formatDateRangeLabel(dateRange.from, dateRange.to)}`}
      hint={onSelect ? 'Click a bar to see transactions' : undefined}
      isEmpty={data.length === 0}
      emptyMessage="No expenses recorded for this period."
    >
      <BarChart data={data} margin={CHART_MARGIN}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
        <XAxis
          dataKey="category"
          tick={CHART_AXIS_TICK}
          className="text-muted-foreground"
        />
        <YAxis
          tick={CHART_AXIS_TICK}
          tickFormatter={chartYAxisTickFormatter}
          className="text-muted-foreground"
        />
        <Tooltip content={<CategoryTooltip />} cursor={CHART_TOOLTIP_CURSOR} />
        <Bar
          dataKey="amount"
          radius={[4, 4, 0, 0]}
          cursor={onSelect ? 'pointer' : undefined}
          activeBar={onSelect ? { fillOpacity: 0.8 } : false}
          onClick={handleBarClick}
        >
          {data.map((entry) => (
            <Cell key={entry.categoryId} fill={entry.fill} />
          ))}
        </Bar>
      </BarChart>
    </ChartCard>
  )
}
