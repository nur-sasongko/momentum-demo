import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { EditableCell } from '#/components/ui/editable-cell'

describe('EditableCell', () => {
  it('renders the default input and saves on blur when no renderInput is given', () => {
    const onSave = vi.fn()
    render(<EditableCell value="hello" onSave={onSave} />)

    fireEvent.click(screen.getByText('hello'))
    const input = screen.getByDisplayValue('hello')
    fireEvent.change(input, { target: { value: 'world' } })
    fireEvent.blur(input)

    expect(onSave).toHaveBeenCalledWith('world')
  })

  it('uses renderInput instead of the default input when provided', () => {
    const onSave = vi.fn()
    render(
      <EditableCell
        value="100"
        onSave={onSave}
        renderInput={({ value, onChange, onCommit }) => (
          <div>
            <span data-testid="custom-value">custom:{value}</span>
            <button
              type="button"
              data-testid="change-input"
              onClick={() => onChange('250')}
            >
              change
            </button>
            <button type="button" data-testid="commit-input" onClick={onCommit}>
              commit
            </button>
          </div>
        )}
      />,
    )

    fireEvent.click(screen.getByText('100'))
    expect(screen.getByTestId('custom-value').textContent).toBe('custom:100')

    fireEvent.click(screen.getByTestId('change-input'))
    expect(screen.getByTestId('custom-value').textContent).toBe('custom:250')

    fireEvent.click(screen.getByTestId('commit-input'))

    expect(onSave).toHaveBeenCalledWith('250')
  })

  it('does not save when renderInput cancels without changing the value', () => {
    const onSave = vi.fn()
    render(
      <EditableCell
        value="100"
        onSave={onSave}
        renderInput={({ onCancel }) => (
          <button type="button" data-testid="cancel-input" onClick={onCancel}>
            cancel
          </button>
        )}
      />,
    )

    fireEvent.click(screen.getByText('100'))
    fireEvent.click(screen.getByTestId('cancel-input'))

    expect(onSave).not.toHaveBeenCalled()
    expect(screen.getByText('100')).toBeTruthy()
  })
})
