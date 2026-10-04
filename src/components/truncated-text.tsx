import { useEffect, useRef, useState } from 'react'
import type { ElementType, ReactNode, RefObject } from 'react'

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '#/components/ui/tooltip'

/**
 * True once the element's content is actually clipped by `truncate` or
 * `line-clamp-*` — measured via `scrollWidth`/`scrollHeight` against the
 * rendered box, not inferred from the text length, so it tracks font
 * changes, zoom, and container resizes.
 */
export function useIsClipped(ref: RefObject<HTMLElement | null>): boolean {
  const [isClipped, setIsClipped] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => {
      setIsClipped(
        el.scrollWidth > el.clientWidth || el.scrollHeight > el.clientHeight,
      )
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [ref])

  return isClipped
}

interface TruncatedTextProps {
  as?: ElementType
  className?: string
  children: ReactNode
}

/**
 * Drop-in replacement for a `truncate` / `line-clamp-*` element that peeks
 * the full text in a tooltip — armed only when the text is actually
 * clipped, so a short label never grows an inert tooltip. See `025`'s
 * "Truncated text peeks with a tooltip, not a `title`" amendment.
 */
export function TruncatedText({
  as: Component = 'span',
  className,
  children,
}: TruncatedTextProps) {
  const ref = useRef<HTMLElement>(null)
  const isClipped = useIsClipped(ref)

  const content = (
    <Component ref={ref} className={className}>
      {children}
    </Component>
  )

  if (!isClipped) return content

  return (
    <TooltipProvider delayDuration={500}>
      <Tooltip>
        <TooltipTrigger asChild>{content}</TooltipTrigger>
        <TooltipContent aria-hidden="true">{children}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
