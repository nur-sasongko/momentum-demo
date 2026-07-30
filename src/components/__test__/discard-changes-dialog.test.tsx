import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { DiscardChangesDialog } from '#/components/discard-changes-dialog'

describe('DiscardChangesDialog', () => {
  it('renders the default title and description when open', () => {
    render(
      <DiscardChangesDialog open onOpenChange={vi.fn()} onDiscard={vi.fn()} />,
    )

    expect(screen.getByText('Discard unsaved changes?')).toBeTruthy()
    expect(
      screen.getByText(
        'You have unsaved changes. Closing now will discard them.',
      ),
    ).toBeTruthy()
  })

  it('renders a custom title and description when provided', () => {
    render(
      <DiscardChangesDialog
        open
        onOpenChange={vi.fn()}
        onDiscard={vi.fn()}
        title="Custom title"
        description="Custom description"
      />,
    )

    expect(screen.getByText('Custom title')).toBeTruthy()
    expect(screen.getByText('Custom description')).toBeTruthy()
  })

  it('calls onOpenChange(false) and not onDiscard when "Keep editing" is clicked', () => {
    const onOpenChange = vi.fn()
    const onDiscard = vi.fn()
    render(
      <DiscardChangesDialog
        open
        onOpenChange={onOpenChange}
        onDiscard={onDiscard}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Keep editing' }))

    expect(onDiscard).not.toHaveBeenCalled()
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('calls onDiscard when "Discard changes" is clicked', () => {
    const onDiscard = vi.fn()
    render(
      <DiscardChangesDialog
        open
        onOpenChange={vi.fn()}
        onDiscard={onDiscard}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Discard changes' }))

    expect(onDiscard).toHaveBeenCalledOnce()
  })

  it('renders nothing interactive when closed', () => {
    render(
      <DiscardChangesDialog
        open={false}
        onOpenChange={vi.fn()}
        onDiscard={vi.fn()}
      />,
    )

    expect(screen.queryByText('Discard unsaved changes?')).toBeNull()
  })
})
