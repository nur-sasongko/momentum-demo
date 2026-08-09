import { renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { useBeforeUnloadGuard } from '#/hooks/use-beforeunload-guard'

describe('useBeforeUnloadGuard', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('attaches the listener only while enabled', () => {
    const addSpy = vi.spyOn(window, 'addEventListener')

    const { rerender } = renderHook(
      ({ enabled }) => useBeforeUnloadGuard(enabled),
      { initialProps: { enabled: false } },
    )
    expect(addSpy).not.toHaveBeenCalledWith(
      'beforeunload',
      expect.any(Function),
    )

    rerender({ enabled: true })
    expect(addSpy).toHaveBeenCalledWith('beforeunload', expect.any(Function))
  })

  it('removes the listener when disabled and on unmount', () => {
    const removeSpy = vi.spyOn(window, 'removeEventListener')

    const { rerender, unmount } = renderHook(
      ({ enabled }) => useBeforeUnloadGuard(enabled),
      { initialProps: { enabled: true } },
    )

    rerender({ enabled: false })
    expect(removeSpy).toHaveBeenCalledWith('beforeunload', expect.any(Function))

    removeSpy.mockClear()
    rerender({ enabled: true })
    unmount()
    expect(removeSpy).toHaveBeenCalledWith('beforeunload', expect.any(Function))
  })

  it('prevents the default action and sets returnValue', () => {
    let handler: ((event: BeforeUnloadEvent) => void) | undefined
    vi.spyOn(window, 'addEventListener').mockImplementation(
      (type, listener) => {
        if (type === 'beforeunload') {
          handler = listener as (event: BeforeUnloadEvent) => void
        }
      },
    )

    renderHook(() => useBeforeUnloadGuard(true))

    const event = {
      preventDefault: vi.fn(),
      returnValue: '',
    } as unknown as BeforeUnloadEvent

    handler?.(event)

    expect(event.preventDefault).toHaveBeenCalledOnce()
    expect(event.returnValue).toBe('')
  })
})
