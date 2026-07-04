import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { CodeBlockLanguageSelector } from '#/routes/_authenticated/notes/-components/code-block-language-selector'

describe('CodeBlockLanguageSelector', () => {
  it('shows the selected language label', () => {
    render(<CodeBlockLanguageSelector value="typescript" onChange={vi.fn()} />)

    expect(screen.getByRole('combobox').textContent).toContain('TypeScript')
  })

  it('disables the select when disabled', () => {
    render(
      <CodeBlockLanguageSelector
        value="javascript"
        onChange={vi.fn()}
        disabled
      />,
    )

    expect(screen.getByRole('combobox')).toHaveProperty('disabled', true)
  })
})
