import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

import {
  ZOOM_MAX,
  ZOOM_MIN,
  ZOOM_STEP,
  clampZoom,
  getContentSize,
  getMaxTickChars,
  getPinchDistance,
  getPinchMidpoint,
} from './chart-zoom'

import type { ChartContentSize, PinchPoint } from './chart-zoom'

/** Pointer movement past which a mouse/touch gesture counts as a pan rather than a tap. */
const PAN_CLICK_THRESHOLD_PX = 5

/** How much a single Ctrl/⌘+wheel tick changes zoom, per pixel of `deltaY`. */
const WHEEL_ZOOM_SENSITIVITY = 0.01

const ZOOM_EPSILON = 1e-6

function getTouchPoint(touch: React.Touch): PinchPoint {
  return { x: touch.clientX, y: touch.clientY }
}

/**
 * Installs a one-shot, capture-phase `click` listener that swallows the very
 * next click on `el`. Recharts fires `<Bar>` `onClick` from a real DOM click
 * on the SVG `<path>`; a pan/pinch gesture implemented on an ancestor does
 * not cancel that click on its own, so this runs right before it reaches the
 * bar and removes itself immediately after.
 */
function installClickBlocker(el: HTMLElement) {
  const blockNextClick = (event: MouseEvent) => {
    event.preventDefault()
    event.stopPropagation()
  }
  el.addEventListener('click', blockNextClick, { capture: true, once: true })
}

function computeAnchoredScroll({
  viewportWidth,
  viewportHeight,
  dataLength,
  fromZoom,
  toZoom,
  fromScrollLeft,
  fromScrollTop,
  anchorX,
  anchorY,
}: {
  viewportWidth: number
  viewportHeight: number
  dataLength: number
  fromZoom: number
  toZoom: number
  fromScrollLeft: number
  fromScrollTop: number
  anchorX: number
  anchorY: number
}): { scrollLeft: number; scrollTop: number } {
  const fromSize = getContentSize({
    viewportWidth,
    viewportHeight,
    dataLength,
    zoom: fromZoom,
  })
  const toSize = getContentSize({
    viewportWidth,
    viewportHeight,
    dataLength,
    zoom: toZoom,
  })

  const ratioX =
    fromSize.width > 0 ? (fromScrollLeft + anchorX) / fromSize.width : 0
  const ratioY =
    fromSize.height > 0 ? (fromScrollTop + anchorY) / fromSize.height : 0

  return {
    scrollLeft: Math.max(0, ratioX * toSize.width - anchorX),
    scrollTop: Math.max(0, ratioY * toSize.height - anchorY),
  }
}

export interface UseChartZoomResult {
  viewportRef: React.RefObject<HTMLDivElement | null>
  contentSize: ChartContentSize
  zoom: number
  maxTickChars: number
  canZoomIn: boolean
  canZoomOut: boolean
  isZoomed: boolean
  isPannable: boolean
  isPanning: boolean
  zoomIn: () => void
  zoomOut: () => void
  reset: () => void
  viewportProps: {
    onPointerDown: (event: React.PointerEvent<HTMLDivElement>) => void
    onTouchStart: (event: React.TouchEvent<HTMLDivElement>) => void
    onTouchMove: (event: React.TouchEvent<HTMLDivElement>) => void
    onTouchEnd: (event: React.TouchEvent<HTMLDivElement>) => void
    onTouchCancel: (event: React.TouchEvent<HTMLDivElement>) => void
  }
}

export function useChartZoom({
  dataLength,
  axisHeightPx,
}: {
  dataLength: number
  axisHeightPx: number
}): UseChartZoomResult {
  const viewportRef = useRef<HTMLDivElement | null>(null)
  const [zoom, setZoom] = useState(ZOOM_MIN)
  const [viewportSize, setViewportSize] = useState<ChartContentSize>({
    width: 0,
    height: 0,
  })
  const [isPanning, setIsPanning] = useState(false)

  // Mirrors `zoom` for event handlers (native listeners, gesture callbacks)
  // that need the latest value without forcing effects to re-subscribe.
  const zoomRef = useRef(zoom)
  zoomRef.current = zoom

  const pendingScrollRef = useRef<{
    scrollLeft: number
    scrollTop: number
  } | null>(null)

  useEffect(() => {
    const container = viewportRef.current
    if (!container) return

    const observer = new ResizeObserver(([entry]) => {
      setViewportSize({
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      })
    })
    observer.observe(container)
    return () => observer.disconnect()
  }, [])

  const contentSize = useMemo(
    () =>
      getContentSize({
        viewportWidth: viewportSize.width,
        viewportHeight: viewportSize.height,
        dataLength,
        zoom,
      }),
    [viewportSize.width, viewportSize.height, dataLength, zoom],
  )

  const maxTickChars = useMemo(
    () => getMaxTickChars(axisHeightPx * zoom),
    [axisHeightPx, zoom],
  )

  useLayoutEffect(() => {
    const container = viewportRef.current
    const pending = pendingScrollRef.current
    if (container && pending) {
      container.scrollLeft = pending.scrollLeft
      container.scrollTop = pending.scrollTop
    }
    pendingScrollRef.current = null
  }, [zoom])

  const applyZoom = useCallback(
    (targetZoom: number, anchor?: { x: number; y: number }) => {
      const nextZoom = clampZoom(targetZoom)
      if (Math.abs(nextZoom - zoomRef.current) < ZOOM_EPSILON) return

      const container = viewportRef.current
      if (!container) {
        setZoom(nextZoom)
        return
      }

      const viewportWidth = container.clientWidth
      const viewportHeight = container.clientHeight
      const anchorX = anchor?.x ?? viewportWidth / 2
      const anchorY = anchor?.y ?? viewportHeight / 2

      pendingScrollRef.current = computeAnchoredScroll({
        viewportWidth,
        viewportHeight,
        dataLength,
        fromZoom: zoomRef.current,
        toZoom: nextZoom,
        fromScrollLeft: container.scrollLeft,
        fromScrollTop: container.scrollTop,
        anchorX,
        anchorY,
      })
      setZoom(nextZoom)
    },
    [dataLength],
  )

  const zoomIn = useCallback(() => {
    applyZoom(zoomRef.current + ZOOM_STEP)
  }, [applyZoom])

  const zoomOut = useCallback(() => {
    applyZoom(zoomRef.current - ZOOM_STEP)
  }, [applyZoom])

  const reset = useCallback(() => {
    pendingScrollRef.current = { scrollLeft: 0, scrollTop: 0 }
    setZoom(ZOOM_MIN)
  }, [])

  // Ctrl/⌘+wheel zoom. React attaches `wheel` as a passive listener at the
  // root, so `preventDefault()` from a JSX `onWheel` prop is a no-op — this
  // must be a manually registered, non-passive native listener to be able to
  // block the page from scrolling/zooming while we handle it.
  useEffect(() => {
    const container = viewportRef.current
    if (!container) return

    const handleWheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return
      event.preventDefault()
      const rect = container.getBoundingClientRect()
      applyZoom(zoomRef.current * (1 - event.deltaY * WHEEL_ZOOM_SENSITIVITY), {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      })
    }

    container.addEventListener('wheel', handleWheel, { passive: false })
    return () => container.removeEventListener('wheel', handleWheel)
  }, [applyZoom])

  // Two-finger pinch — anchored on the pinch midpoint. Single-finger touch
  // panning is left to the browser's native scrolling (the viewport's
  // `touch-action: pan-x pan-y` keeps that available without any JS here).
  const pinchOriginRef = useRef<{ distance: number; zoom: number } | null>(null)

  const handleTouchStart = useCallback(
    (event: React.TouchEvent<HTMLDivElement>) => {
      if (event.touches.length !== 2) return
      pinchOriginRef.current = {
        distance: getPinchDistance(
          getTouchPoint(event.touches[0]),
          getTouchPoint(event.touches[1]),
        ),
        zoom: zoomRef.current,
      }
    },
    [],
  )

  const handleTouchMove = useCallback(
    (event: React.TouchEvent<HTMLDivElement>) => {
      const origin = pinchOriginRef.current
      const container = viewportRef.current
      if (event.touches.length !== 2 || !origin || !container) return

      const pointA = getTouchPoint(event.touches[0])
      const pointB = getTouchPoint(event.touches[1])
      const distance = getPinchDistance(pointA, pointB)
      const midpoint = getPinchMidpoint(pointA, pointB)
      const rect = container.getBoundingClientRect()

      applyZoom(origin.zoom * (distance / origin.distance), {
        x: midpoint.x - rect.left,
        y: midpoint.y - rect.top,
      })
    },
    [applyZoom],
  )

  const handleTouchEnd = useCallback(
    (event: React.TouchEvent<HTMLDivElement>) => {
      if (event.touches.length > 0) return
      const container = viewportRef.current
      if (pinchOriginRef.current && container) {
        installClickBlocker(container)
      }
      pinchOriginRef.current = null
    },
    [],
  )

  // Mouse drag-to-pan, modelled on tasks/-components/task-board.tsx: bail on
  // non-primary button and non-mouse pointer types, bind move/up on
  // `window` so the drag keeps tracking outside the viewport, and suppress
  // `user-select` while dragging.
  const panOriginRef = useRef<{
    x: number
    y: number
    scrollLeft: number
    scrollTop: number
  } | null>(null)
  const didPanRef = useRef(false)

  const handlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (event.button !== 0 || event.pointerType !== 'mouse') return
      const target = event.target as HTMLElement
      if (target.closest('button, [role="button"]')) return
      const container = viewportRef.current
      if (!container) return

      panOriginRef.current = {
        x: event.clientX,
        y: event.clientY,
        scrollLeft: container.scrollLeft,
        scrollTop: container.scrollTop,
      }
      didPanRef.current = false
      setIsPanning(true)
    },
    [],
  )

  useEffect(() => {
    if (!isPanning) return
    const container = viewportRef.current
    if (!container) return

    const handlePointerMove = (event: PointerEvent) => {
      const origin = panOriginRef.current
      if (!origin) return
      const dx = event.clientX - origin.x
      const dy = event.clientY - origin.y
      if (!didPanRef.current && Math.hypot(dx, dy) > PAN_CLICK_THRESHOLD_PX) {
        didPanRef.current = true
      }
      container.scrollLeft = origin.scrollLeft - dx
      container.scrollTop = origin.scrollTop - dy
    }

    const stopPanning = () => {
      if (didPanRef.current) installClickBlocker(container)
      panOriginRef.current = null
      didPanRef.current = false
      setIsPanning(false)
    }

    document.body.style.userSelect = 'none'
    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', stopPanning)
    window.addEventListener('pointercancel', stopPanning)
    return () => {
      document.body.style.userSelect = ''
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', stopPanning)
      window.removeEventListener('pointercancel', stopPanning)
    }
  }, [isPanning])

  const isPannable =
    contentSize.width > viewportSize.width + 1 ||
    contentSize.height > viewportSize.height + 1

  return {
    viewportRef,
    contentSize,
    zoom,
    maxTickChars,
    canZoomIn: zoom < ZOOM_MAX - ZOOM_EPSILON,
    canZoomOut: zoom > ZOOM_MIN + ZOOM_EPSILON,
    isZoomed: zoom > ZOOM_MIN + ZOOM_EPSILON,
    isPannable,
    isPanning,
    zoomIn,
    zoomOut,
    reset,
    viewportProps: {
      onPointerDown: handlePointerDown,
      onTouchStart: handleTouchStart,
      onTouchMove: handleTouchMove,
      onTouchEnd: handleTouchEnd,
      onTouchCancel: handleTouchEnd,
    },
  }
}
