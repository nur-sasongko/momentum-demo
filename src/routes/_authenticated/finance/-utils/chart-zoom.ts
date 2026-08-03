// Pure, DOM-free helpers backing chart zoom/pan. Kept separate from
// use-chart-zoom.ts so the sizing/geometry math can be unit-tested without a
// browser environment.

export const ZOOM_MIN = 1
export const ZOOM_MAX = 3
export const ZOOM_STEP = 0.25

/** Minimum horizontal space a single category/day gets before its label starts colliding with its neighbour. */
export const MIN_BAND_PX = 48

/** Left/right breathing room added on top of the per-bar bands. */
const CONTENT_GUTTER_PX = 32

/** Fallback content height (matches the chart's existing fixed `height={256}`) used when the viewport hasn't been measured yet. */
const BASE_CONTENT_HEIGHT_PX = 256

/** Padding subtracted from the axis band before computing the diagonal a rotated label can occupy. */
const AXIS_HEIGHT_PADDING_PX = 10

const TICK_ANGLE_RAD = (35 * Math.PI) / 180

/** Rough average glyph width (px) for the 12px tick font, used to convert an available diagonal length into a character budget. */
const AVG_CHAR_PX = 6.2

export const MIN_TICK_CHARS = 3
export const MAX_TICK_CHARS = 24

export interface ChartContentSize {
  width: number
  height: number
}

export interface ChartZoomState {
  zoom: number
  /** Characters that fit in the angled axis band at the current zoom. */
  maxTickChars: number
}

export function clampZoom(zoom: number): number {
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, zoom))
}

/**
 * Size of the scrollable content div that hosts the Recharts
 * `ResponsiveContainer`. Width is the larger of the measured viewport and a
 * data-driven minimum (so dense data always gets `MIN_BAND_PX` per bar);
 * height falls back to the chart's fixed base height when the viewport
 * hasn't been measured (jsdom, a hidden tab). Both dimensions scale linearly
 * with `zoom`.
 */
export function getContentSize({
  viewportWidth,
  viewportHeight,
  dataLength,
  zoom,
}: {
  viewportWidth: number
  viewportHeight: number
  dataLength: number
  zoom: number
}): ChartContentSize {
  const dataMinWidth = dataLength * MIN_BAND_PX + CONTENT_GUTTER_PX
  const baseWidth =
    viewportWidth > 0 ? Math.max(viewportWidth, dataMinWidth) : dataMinWidth
  const baseHeight =
    viewportHeight > 0 ? viewportHeight : BASE_CONTENT_HEIGHT_PX

  return {
    width: Math.round(baseWidth * zoom),
    height: Math.round(baseHeight * zoom),
  }
}

/**
 * How many characters of a −35° angled tick label fit before it needs
 * truncating, given the pixel height of the axis band at the current zoom.
 */
export function getMaxTickChars(axisHeightPx: number): number {
  const usableHeight = Math.max(axisHeightPx - AXIS_HEIGHT_PADDING_PX, 0)
  const diagonalPx = usableHeight / Math.sin(TICK_ANGLE_RAD)
  const chars = Math.floor(diagonalPx / AVG_CHAR_PX)
  return Math.min(MAX_TICK_CHARS, Math.max(MIN_TICK_CHARS, chars))
}

/** Truncates `label` to `maxChars`, appending an ellipsis only when characters were actually dropped. */
export function truncateLabel(label: string, maxChars: number): string {
  if (label.length <= maxChars) return label
  if (maxChars <= 1) return '…'
  return `${label.slice(0, maxChars - 1)}…`
}

export interface PinchPoint {
  x: number
  y: number
}

export function getPinchDistance(a: PinchPoint, b: PinchPoint): number {
  return Math.hypot(b.x - a.x, b.y - a.y)
}

export function getPinchMidpoint(a: PinchPoint, b: PinchPoint): PinchPoint {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
}
