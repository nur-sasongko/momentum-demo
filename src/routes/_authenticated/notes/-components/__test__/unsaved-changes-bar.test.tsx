import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { UnsavedChangesBar } from '../unsaved-changes-bar'

describe('UnsavedChangesBar', () => {
  it('renders the dirty state with an enabled Save button and a polite live region', () => {
    render(<UnsavedChangesBar state="dirty" onSave={vi.fn()} />)

    expect(screen.getByText('Unsaved changes')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Save' }).disabled).toBe(false)

    const status = screen.getByRole('status')
    expect(status.getAttribute('aria-live')).toBe('polite')
  })

  it('renders the saving state with a disabled Save button', () => {
    render(<UnsavedChangesBar state="saving" onSave={vi.fn()} />)

    expect(screen.getByText('Saving…')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Save' }).disabled).toBe(true)
  })

  it('calls onSave once per click', () => {
    const onSave = vi.fn()
    render(<UnsavedChangesBar state="dirty" onSave={onSave} />)

    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(onSave).toHaveBeenCalledTimes(1)
  })
})
