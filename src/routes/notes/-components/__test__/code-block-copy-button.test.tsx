import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  CodeBlockCopyButton,
  copyCodeToClipboard,
} from '#/routes/notes/-components/code-block-copy-button'

import { toast } from 'sonner'

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

describe('copyCodeToClipboard', () => {
  it('writes plain code text to clipboard', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { clipboard: { writeText } })

    await copyCodeToClipboard('const answer = 42')

    expect(writeText).toHaveBeenCalledWith('const answer = 42')
  })
})

describe('CodeBlockCopyButton', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('navigator', {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    })
  })

  it('copies code and shows success toast', async () => {
    render(<CodeBlockCopyButton code="console.log('hi')" />)

    fireEvent.click(screen.getByRole('button', { name: /copy code/i }))

    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        "console.log('hi')",
      )
      expect(toast.success).toHaveBeenCalledWith('Code copied to clipboard')
    })
  })

  it('shows error toast when clipboard fails', async () => {
    vi.stubGlobal('navigator', {
      clipboard: {
        writeText: vi.fn().mockRejectedValue(new Error('denied')),
      },
    })

    render(<CodeBlockCopyButton code="fail" />)

    fireEvent.click(screen.getByRole('button', { name: /copy code/i }))

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Failed to copy code')
    })
  })
})
