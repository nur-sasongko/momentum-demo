import * as React from 'react'

const WIDE_BREAKPOINT = 1280

export function useIsWide() {
  const [isWide, setIsWide] = React.useState<boolean | undefined>(undefined)

  React.useEffect(() => {
    const mql = window.matchMedia(`(min-width: ${WIDE_BREAKPOINT}px)`)
    const onChange = () => {
      setIsWide(window.innerWidth >= WIDE_BREAKPOINT)
    }
    mql.addEventListener('change', onChange)
    setIsWide(window.innerWidth >= WIDE_BREAKPOINT)
    return () => mql.removeEventListener('change', onChange)
  }, [])

  return !!isWide
}
