'use client'

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import { useFinanceStore } from '#/stores/finance-store'
import { AngledCategoryTick } from './chart-axis-tick'
import {
  ANGLED_AXIS_HEIGHT,
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
  getDailySpendingByCategory,
} from '../-utils/finance-utils'
import { useFinanceFilters } from '../-utils/use-finance-filters'
import { selectionFromDaySegment } from '../-utils/finance-drilldown'

import type {
  BarRectangleItem,
  TooltipPayloadEntry,
  TooltipProps,
} from 'recharts'
import type { DailySpendingPoint } from '../-utils/finance-utils'
import type { DrilldownSelection } from '../-utils/finance-drilldown'

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

export function SpendingByDailyChart({
  onSelect,
}: {
  onSelect?: (selection: DrilldownSelection) => void
}) {
  const { dateRange } = useFinanceFilters()
  const categories = useFinanceStore((s) => s.categories)
  const { data: aggregateRows = [] } = useFinanceAggregateQuery()

  const { data, series } = getDailySpendingByCategory(
    aggregateRows,
    dateRange,
    categories,
  )

  const hasRange = Boolean(dateRange.from && dateRange.to)
  const isEmpty = !hasRange || series.length === 0
  const emptyMessage = !hasRange
    ? 'Pick a date range to see daily spending.'
    : 'No expenses recorded for this period.'

  return (
    <ChartCard
      title="Daily spending"
      description={`Expenses by day — ${formatDateRangeLabel(dateRange.from, dateRange.to)}`}
      hint={
        onSelect
          ? 'Click a segment to see transactions · pinch or use +/− to zoom'
          : undefined
      }
      isEmpty={isEmpty}
      emptyMessage={emptyMessage}
      zoomable
      dataLength={data.length}
    >
      <BarChart data={data} margin={CHART_MARGIN}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
        <XAxis
          dataKey="dateLabel"
          interval={0}
          height={ANGLED_AXIS_HEIGHT}
          tick={<AngledCategoryTick />}
          className="text-muted-foreground"
        />
        <YAxis
          tick={CHART_AXIS_TICK}
          tickFormatter={chartYAxisTickFormatter}
          className="text-muted-foreground"
        />
        <Tooltip content={<DailyTooltip />} cursor={CHART_TOOLTIP_CURSOR} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        {series.map((s, index) => (
          <Bar
            key={s.key}
            dataKey={s.key}
            name={s.name}
            stackId="day"
            fill={s.color}
            radius={index === series.length - 1 ? [4, 4, 0, 0] : undefined}
            cursor={onSelect ? 'pointer' : undefined}
            activeBar={onSelect ? { fillOpacity: 0.8 } : false}
            onClick={(entry: BarRectangleItem) => {
              if (!onSelect) return
              const point = entry.payload as DailySpendingPoint | undefined
              if (!point) return
              const selection = selectionFromDaySegment(point, s)
              if (selection) onSelect(selection)
            }}
          />
        ))}
      </BarChart>
    </ChartCard>
  )
}
