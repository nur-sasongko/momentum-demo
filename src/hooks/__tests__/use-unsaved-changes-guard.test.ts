import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { useUnsavedChangesGuard } from '#/hooks/use-unsaved-changes-guard'

describe('useUnsavedChangesGuard', () => {
  it('closes immediately when not dirty', () => {
    const onClose = vi.fn()
    const { result } = renderHook(() => useUnsavedChangesGuard(false, onClose))

    act(() => {
      result.current.requestClose()
    })

    expect(onClose).toHaveBeenCalledOnce()
    expect(result.current.confirmOpen).toBe(false)
  })

  it('opens the confirm dialog instead of closing when dirty', () => {
    const onClose = vi.fn()
    const { result } = renderHook(() => useUnsavedChangesGuard(true, onClose))

    act(() => {
      result.current.requestClose()
    })

    expect(onClose).not.toHaveBeenCalled()
    expect(result.current.confirmOpen).toBe(true)
  })

  it('allows manually closing the confirm dialog via setConfirmOpen', () => {
    const onClose = vi.fn()
    const { result } = renderHook(() => useUnsavedChangesGuard(true, onClose))

    act(() => {
      result.current.requestClose()
    })
    expect(result.current.confirmOpen).toBe(true)

    act(() => {
      result.current.setConfirmOpen(false)
    })
    expect(result.current.confirmOpen).toBe(false)
    expect(onClose).not.toHaveBeenCalled()
  })
})
