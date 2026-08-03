import { Minus, Plus, RotateCcw } from 'lucide-react'

import { Button } from '#/components/ui/button'

export function ChartZoomControls({
  zoom,
  canZoomIn,
  canZoomOut,
  isZoomed,
  onZoomIn,
  onZoomOut,
  onReset,
}: {
  zoom: number
  canZoomIn: boolean
  canZoomOut: boolean
  isZoomed: boolean
  onZoomIn: () => void
  onZoomOut: () => void
  onReset: () => void
}) {
  return (
    <div className="absolute top-2 right-2 z-10 flex items-center gap-0.5 rounded-md border bg-background/80 px-1 py-0.5 shadow-sm backdrop-blur-sm">
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        aria-label="Zoom out"
        disabled={!canZoomOut}
        onClick={onZoomOut}
      >
        <Minus />
      </Button>
      <span className="w-10 text-center text-xs tabular-nums text-muted-foreground">
        {Math.round(zoom * 100)}%
      </span>
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        aria-label="Zoom in"
        disabled={!canZoomIn}
        onClick={onZoomIn}
      >
        <Plus />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        aria-label="Reset zoom"
        disabled={!isZoomed}
        onClick={onReset}
      >
        <RotateCcw />
      </Button>
    </div>
  )
}
