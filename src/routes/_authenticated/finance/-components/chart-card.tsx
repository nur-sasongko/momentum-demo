import { ResponsiveContainer } from 'recharts'

import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '#/components/ui/card'
import { cn } from '#/libs/utils'
import { ChartZoomContext } from './chart-axis-tick'
import { ChartZoomControls } from './chart-zoom-controls'
import { useChartZoom } from '../-utils/use-chart-zoom'

import type { ReactNode } from 'react'

/** Shared margins so all three finance charts align visually. */
export const CHART_MARGIN = { top: 8, right: 8, left: 0, bottom: 8 }

/** Shared axis tick style. `fontFamily` reaches the Recharts default tick's `<text>` element as a plain SVG attribute. */
export const CHART_AXIS_TICK = {
  fontSize: 12,
  fontFamily: 'var(--font-numeric)',
}

/** Fixed height of the chart plot, shared by the wrapper div and `ResponsiveContainer` so they can't drift apart. */
export const CHART_HEIGHT_PX = 256

/** Height reserved for the −35° angled category axis, via `<XAxis height={ANGLED_AXIS_HEIGHT}>`. */
export const ANGLED_AXIS_HEIGHT = 70

/**
 * Shared tooltip cursor fill. Uses the raw CSS variable, not `hsl(var(...))`
 * — this app's theme variables are defined as `oklch()` values, so wrapping
 * one in `hsl()` produced an invalid color (the hover cursor silently never
 * rendered).
 *
 * `--border` rather than `--muted`: the design system keeps card/muted close
 * in lightness by intent (a quiet sunken-panel step), which left the cursor
 * almost imperceptible against the chart's card background. `--border` sits
 * further from `--card` in both themes and reads as a real highlight.
 */
export const CHART_TOOLTIP_CURSOR = { fill: 'var(--border)', opacity: 0.5 }

export function chartYAxisTickFormatter(value: number): string {
  return value >= 1000 ? `${(value / 1000).toFixed(1)}k` : String(value)
}

export function ChartCard({
  title,
  description,
  hint,
  action,
  isEmpty,
  emptyMessage,
  zoomable = false,
  dataLength = 0,
  children,
}: {
  title: string
  description: ReactNode
  /** Small hint line under the description, e.g. "Click a bar to see transactions". */
  hint?: ReactNode
  action?: ReactNode
  isEmpty: boolean
  emptyMessage: string
  /** Mounts the zoom/pan viewport and overlay controls. No-op while `isEmpty`. */
  zoomable?: boolean
  /** Category/day count backing `children`, used to size the zoomed content. */
  dataLength?: number
  children: ReactNode
}) {
  const chartZoom = useChartZoom({
    dataLength,
    axisHeightPx: ANGLED_AXIS_HEIGHT,
  })
  const showZoomUi = zoomable && !isEmpty

  return (
    <Card className="gap-4 py-5">
      <CardHeader className="px-5 pb-0">
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
        {action && <CardAction>{action}</CardAction>}
      </CardHeader>
      <CardContent className="px-5">
        {isEmpty ? (
          <p className="py-12 text-center text-sm text-muted-foreground">
            {emptyMessage}
          </p>
        ) : showZoomUi ? (
          <ChartZoomContext.Provider value={chartZoom.maxTickChars}>
            <div
              className="relative w-full"
              style={{ height: CHART_HEIGHT_PX }}
            >
              <div
                ref={chartZoom.viewportRef}
                {...chartZoom.viewportProps}
                className={cn(
                  'absolute inset-0 overflow-auto overscroll-contain',
                  chartZoom.isPannable &&
                    (chartZoom.isPanning ? 'cursor-grabbing' : 'cursor-grab'),
                )}
                style={{ touchAction: 'pan-x pan-y' }}
              >
                <div
                  style={{
                    width: chartZoom.contentSize.width,
                    height: chartZoom.contentSize.height,
                  }}
                >
                  <ResponsiveContainer
                    width={chartZoom.contentSize.width}
                    height={chartZoom.contentSize.height}
                  >
                    {children}
                  </ResponsiveContainer>
                </div>
              </div>
              <ChartZoomControls
                zoom={chartZoom.zoom}
                canZoomIn={chartZoom.canZoomIn}
                canZoomOut={chartZoom.canZoomOut}
                isZoomed={chartZoom.isZoomed}
                onZoomIn={chartZoom.zoomIn}
                onZoomOut={chartZoom.zoomOut}
                onReset={chartZoom.reset}
              />
            </div>
          </ChartZoomContext.Provider>
        ) : (
          <div className="w-full" style={{ height: CHART_HEIGHT_PX }}>
            <ResponsiveContainer width="100%" height={CHART_HEIGHT_PX}>
              {children}
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
