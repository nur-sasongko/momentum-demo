import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { MarkdownEditor } from '../markdown-editor'

describe('MarkdownEditor', () => {
  it('renders the initial markdown value as formatted rich text', () => {
    render(
      <MarkdownEditor
        value="**bold** and a [link](https://example.com)"
        onChange={vi.fn()}
      />,
    )

    expect(screen.getByText('bold').tagName).toBe('STRONG')
    const link = screen.getByRole('link', { name: 'link' })
    expect(link.getAttribute('href')).toBe('https://example.com')
  })

  it('renders a toolbar with formatting controls', () => {
    render(<MarkdownEditor value="" onChange={vi.fn()} />)

    expect(screen.getByRole('button', { name: 'Bold' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Italic' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Bullet list' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Numbered list' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Link' })).toBeTruthy()
  })

  it('shows the placeholder when empty', () => {
    render(
      <MarkdownEditor
        value=""
        onChange={vi.fn()}
        placeholder="Optional description"
      />,
    )

    expect(
      document.querySelector('[data-placeholder="Optional description"]'),
    ).toBeTruthy()
  })

  it('applies the given id to the editable content for label association', () => {
    render(<MarkdownEditor id="tx-note" value="hello" onChange={vi.fn()} />)

    expect(document.getElementById('tx-note')).toBeTruthy()
  })

  it('re-renders updated content when the value prop changes externally', () => {
    const { rerender } = render(
      <MarkdownEditor value="first note" onChange={vi.fn()} />,
    )
    expect(screen.getByText('first note')).toBeTruthy()

    rerender(<MarkdownEditor value="second note" onChange={vi.fn()} />)

    expect(screen.getByText('second note')).toBeTruthy()
    expect(screen.queryByText('first note')).toBeNull()
  })
})
