import { ResponsiveContainer } from 'recharts'

import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '#/components/ui/card'

import type { ReactNode } from 'react'

/** Shared margins so all three finance charts align visually. */
export const CHART_MARGIN = { top: 8, right: 8, left: 0, bottom: 0 }

/** Shared axis tick style. */
export const CHART_AXIS_TICK = { fontSize: 12 }

/**
 * Shared tooltip cursor fill. Uses the raw CSS variable, not `hsl(var(...))`
 * — this app's theme variables are defined as `oklch()` values, so wrapping
 * one in `hsl()` produced an invalid color (the hover cursor silently never
 * rendered).
 */
export const CHART_TOOLTIP_CURSOR = { fill: 'var(--muted)', opacity: 0.4 }

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
  children,
}: {
  title: string
  description: ReactNode
  /** Small hint line under the description, e.g. "Click a bar to see transactions". */
  hint?: ReactNode
  action?: ReactNode
  isEmpty: boolean
  emptyMessage: string
  children: ReactNode
}) {
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
        ) : (
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height={256}>
              {children}
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
