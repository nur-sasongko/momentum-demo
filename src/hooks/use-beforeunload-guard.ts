import { useEffect } from 'react'

/**
 * Registers a `beforeunload` listener only while `enabled`, prompting the
 * browser's native "unsaved changes" confirmation on reload/close.
 */
export function useBeforeUnloadGuard(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [enabled])
}
