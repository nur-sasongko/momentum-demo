import { createContext, useContext } from 'react'

import { MAX_TICK_CHARS, truncateLabel } from '../-utils/chart-zoom'

import type { XAxisTickContentProps } from 'recharts'

/**
 * Truncation budget (characters) for angled category ticks, provided by
 * `ChartCard` when zoomable. Ticks render deep inside the Recharts SVG tree
 * where props can't be threaded from the chart component, but context still
 * reaches them. Defaults to the generous upper bound so a tick rendered
 * outside a provider never truncates unnecessarily.
 */
export const ChartZoomContext = createContext<number>(MAX_TICK_CHARS)

const TICK_ANGLE_DEG = -35

/**
 * Custom `<XAxis>` tick: every category gets a label (no Recharts
 * `interval` collision-dropping), angled at −35° so long names have room,
 * and truncated with an ellipsis only when they still don't fit.
 *
 * Typed as `Partial<XAxisTickContentProps>` (all optional) because Recharts
 * clones this element with its computed tick props at render time — the
 * `<AngledCategoryTick />` JSX call site itself never passes any props, so a
 * fully-required prop type would fail to type-check there even though every
 * field is present by the time this actually renders.
 */
export function AngledCategoryTick(props: Partial<XAxisTickContentProps>) {
  const { x = 0, y = 0, payload } = props
  const maxTickChars = useContext(ChartZoomContext)
  const value = String(payload?.value ?? '')
  const label = truncateLabel(value, maxTickChars)

  return (
    <g transform={`translate(${x},${y})`}>
      <text
        x={0}
        y={0}
        dx={-4}
        dy={8}
        transform={`rotate(${TICK_ANGLE_DEG})`}
        textAnchor="end"
        fill="currentColor"
        className="text-xs text-muted-foreground"
      >
        {label}
      </text>
    </g>
  )
}
