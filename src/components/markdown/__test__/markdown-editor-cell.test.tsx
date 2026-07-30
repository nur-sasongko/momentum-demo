import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { MarkdownEditorCell } from '../markdown-editor-cell'

// The real MarkdownEditor (TipTap) is exercised by its own test suite;
// stubbing it here isolates MarkdownEditorCell's own open/draft/commit logic
// from ProseMirror's editing internals, which don't simulate typing reliably
// in jsdom.
vi.mock('../markdown-editor', () => ({
  MarkdownEditor: ({
    value,
    onChange,
  }: {
    value: string
    onChange: (next: string) => void
  }) => (
    <input
      aria-label="stub-editor"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
}))

describe('MarkdownEditorCell', () => {
  it('renders a compact rendered preview when closed', () => {
    render(<MarkdownEditorCell value="**bold** note" onSave={vi.fn()} />)

    expect(screen.getByText('bold').tagName).toBe('STRONG')
  })

  it('shows a muted placeholder dash when empty', () => {
    render(<MarkdownEditorCell value="" onSave={vi.fn()} />)

    expect(screen.getByText('—')).toBeTruthy()
  })

  it('opens the full editor with the current value on click', () => {
    render(<MarkdownEditorCell value="hello" onSave={vi.fn()} />)

    fireEvent.click(screen.getByText('hello'))

    expect(screen.getByLabelText('stub-editor')).toHaveProperty(
      'value',
      'hello',
    )
    expect(screen.getByRole('button', { name: 'Done' })).toBeTruthy()
  })

  it('calls onSave with the new value when Done is clicked after an edit', () => {
    const onSave = vi.fn()
    render(<MarkdownEditorCell value="hello" onSave={onSave} />)

    fireEvent.click(screen.getByText('hello'))
    fireEvent.change(screen.getByLabelText('stub-editor'), {
      target: { value: 'hello world' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Done' }))

    expect(onSave).toHaveBeenCalledWith('hello world')
  })

  it('does not call onSave when closed without changes', () => {
    const onSave = vi.fn()
    render(<MarkdownEditorCell value="hello" onSave={onSave} />)

    fireEvent.click(screen.getByText('hello'))
    fireEvent.click(screen.getByRole('button', { name: 'Done' }))

    expect(onSave).not.toHaveBeenCalled()
  })
})
