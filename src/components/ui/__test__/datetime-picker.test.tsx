import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { DateTimePicker } from '#/components/ui/datetime-picker'

describe('DateTimePicker', () => {
  it('opens a single popover with a calendar and a time field on trigger click', () => {
    const iso = new Date(2026, 6, 15, 14, 30, 0, 0).toISOString()
    render(
      <DateTimePicker
        value={iso}
        onChange={vi.fn()}
        trigger={<button type="button">Jul 15, 2:30 PM</button>}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Jul 15, 2:30 PM' }))

    expect(screen.getByRole('dialog')).toBeTruthy()
    expect(screen.getByLabelText('Time (optional)')).toBeTruthy()
    expect(screen.getByLabelText('Time (optional)')).toHaveProperty(
      'value',
      '14:30',
    )
  })

  it('leaves the time field empty when no explicit time is set', () => {
    const iso = new Date(2026, 6, 15, 0, 0, 0, 0).toISOString()
    render(
      <DateTimePicker
        value={iso}
        onChange={vi.fn()}
        trigger={<button type="button">Jul 15</button>}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Jul 15' }))

    expect(screen.getByLabelText('Time (optional)')).toHaveProperty('value', '')
  })

  it('calls onChange with the time merged into the existing date when the time field changes', () => {
    const onChange = vi.fn()
    const iso = new Date(2026, 6, 15, 0, 0, 0, 0).toISOString()
    render(
      <DateTimePicker
        value={iso}
        onChange={onChange}
        trigger={<button type="button">Jul 15</button>}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Jul 15' }))
    fireEvent.change(screen.getByLabelText('Time (optional)'), {
      target: { value: '09:15' },
    })

    const [savedIso] = onChange.mock.calls[0]
    const saved = new Date(savedIso)
    expect(saved.getFullYear()).toBe(2026)
    expect(saved.getMonth()).toBe(6)
    expect(saved.getDate()).toBe(15)
    expect(saved.getHours()).toBe(9)
    expect(saved.getMinutes()).toBe(15)
  })

  it('does not show a clear-time button when no explicit time is set', () => {
    const iso = new Date(2026, 6, 15, 0, 0, 0, 0).toISOString()
    render(
      <DateTimePicker
        value={iso}
        onChange={vi.fn()}
        trigger={<button type="button">Jul 15</button>}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Jul 15' }))

    expect(screen.queryByRole('button', { name: 'Clear time' })).toBeNull()
  })

  it('clears the time back to date-only when the clear-time button is clicked', () => {
    const onChange = vi.fn()
    const iso = new Date(2026, 6, 15, 14, 30, 0, 0).toISOString()
    render(
      <DateTimePicker
        value={iso}
        onChange={onChange}
        trigger={<button type="button">Jul 15, 2:30 PM</button>}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Jul 15, 2:30 PM' }))
    fireEvent.click(screen.getByRole('button', { name: 'Clear time' }))

    const [savedIso] = onChange.mock.calls[0]
    const saved = new Date(savedIso)
    expect(saved.getHours()).toBe(0)
    expect(saved.getMinutes()).toBe(0)
    expect(saved.getDate()).toBe(15)
  })

  it('closes the popover when Done is clicked', () => {
    const iso = new Date(2026, 6, 15, 0, 0, 0, 0).toISOString()
    render(
      <DateTimePicker
        value={iso}
        onChange={vi.fn()}
        trigger={<button type="button">Jul 15</button>}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Jul 15' }))
    expect(screen.getByRole('dialog')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Done' }))
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})
