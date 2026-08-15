import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { ConfirmDialog } from '#/components/confirm-dialog'

describe('ConfirmDialog', () => {
  it('renders the title and description when open', () => {
    render(
      <ConfirmDialog
        open
        onOpenChange={vi.fn()}
        onConfirm={vi.fn()}
        title="Move to Archive?"
        description="This item will be archived."
      />,
    )

    expect(screen.getByText('Move to Archive?')).toBeTruthy()
    expect(screen.getByText('This item will be archived.')).toBeTruthy()
  })

  it('calls onConfirm only when the confirm button is clicked', () => {
    const onConfirm = vi.fn()
    const onOpenChange = vi.fn()
    render(
      <ConfirmDialog
        open
        onOpenChange={onOpenChange}
        onConfirm={onConfirm}
        title="Delete permanently?"
        description="This cannot be undone."
        confirmLabel="Delete permanently"
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Delete permanently' }))

    expect(onConfirm).toHaveBeenCalledOnce()
  })

  it('does not call onConfirm when cancel is clicked', () => {
    const onConfirm = vi.fn()
    const onOpenChange = vi.fn()
    render(
      <ConfirmDialog
        open
        onOpenChange={onOpenChange}
        onConfirm={onConfirm}
        title="Move to Archive?"
        description="This item will be archived."
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(onConfirm).not.toHaveBeenCalled()
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('uses custom cancel/confirm labels when provided', () => {
    render(
      <ConfirmDialog
        open
        onOpenChange={vi.fn()}
        onConfirm={vi.fn()}
        title="Move to Archive?"
        description="This item will be archived."
        confirmLabel="Move to Archive"
        cancelLabel="Keep it"
      />,
    )

    expect(screen.getByRole('button', { name: 'Move to Archive' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Keep it' })).toBeTruthy()
  })

  it('renders nothing interactive when closed', () => {
    render(
      <ConfirmDialog
        open={false}
        onOpenChange={vi.fn()}
        onConfirm={vi.fn()}
        title="Move to Archive?"
        description="This item will be archived."
      />,
    )

    expect(screen.queryByText('Move to Archive?')).toBeNull()
  })
})
