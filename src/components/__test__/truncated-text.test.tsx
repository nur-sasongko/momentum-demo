import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { TruncatedText } from '#/components/truncated-text'

/**
 * jsdom always reports zero-sized layout, so `scrollWidth`/`clientWidth`
 * (and their height counterparts) never disagree on their own. Stubbing the
 * getters on the prototype — read once, synchronously, by the hook's
 * mount-time measurement — is the only way to exercise the "actually
 * clipped" branch.
 */
function stubClipped({
  width = false,
  height = false,
}: {
  width?: boolean
  height?: boolean
}) {
  Object.defineProperty(HTMLElement.prototype, 'scrollWidth', {
    configurable: true,
    get: () => (width ? 200 : 100),
  })
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
    configurable: true,
    get: () => 100,
  })
  Object.defineProperty(HTMLElement.prototype, 'scrollHeight', {
    configurable: true,
    get: () => (height ? 200 : 100),
  })
  Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
    configurable: true,
    get: () => 100,
  })
}

beforeEach(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  )
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('TruncatedText', () => {
  it('renders its children unchanged', () => {
    stubClipped({})
    render(<TruncatedText>Intro</TruncatedText>)

    expect(screen.getByText('Intro')).toBeTruthy()
  })

  it('does not arm a tooltip when the text is not clipped', () => {
    stubClipped({})
    render(<TruncatedText>Intro</TruncatedText>)

    fireEvent.focus(screen.getByText('Intro'))

    expect(screen.queryByRole('tooltip', { hidden: true })).toBeNull()
  })

  it('arms a tooltip when the width is clipped', () => {
    stubClipped({ width: true })
    render(<TruncatedText>A heading that overflows its row</TruncatedText>)

    fireEvent.focus(screen.getByText('A heading that overflows its row'))

    // 3, not 2: the trigger, the tooltip's visible content, and a
    // visually-hidden accessible duplicate Radix renders inside
    // `TooltipContent` for its `role="tooltip"` node (see
    // `@radix-ui/react-tooltip`'s `VisuallyHiddenContentContextProvider`).
    expect(screen.getAllByText('A heading that overflows its row').length).toBe(
      3,
    )
  })

  it('arms a tooltip when the height is clipped (line-clamp)', () => {
    stubClipped({ height: true })
    render(<TruncatedText as="p">A clamped excerpt</TruncatedText>)

    fireEvent.focus(screen.getByText('A clamped excerpt'))

    expect(screen.getAllByText('A clamped excerpt').length).toBe(3)
  })

  it('marks the tooltip content aria-hidden so it is not announced twice', () => {
    stubClipped({ width: true })
    render(<TruncatedText>Clipped label</TruncatedText>)

    fireEvent.focus(screen.getByText('Clipped label'))

    // Without the accessibility-tree escape hatch, the `role="tooltip"` node
    // (Radix's visually-hidden accessible duplicate) is unreachable — it
    // inherits hiddenness from its `aria-hidden="true"` ancestor
    // (`TooltipContent`), which is exactly what keeps it from being
    // announced twice alongside the trigger's own accessible name.
    expect(screen.queryByRole('tooltip')).toBeNull()

    const tooltip = screen.getByRole('tooltip', { hidden: true })
    expect(tooltip.closest('[aria-hidden="true"]')).not.toBeNull()
  })

  it('renders as the given element', () => {
    stubClipped({})
    render(<TruncatedText as="h3">Untitled</TruncatedText>)

    expect(screen.getByRole('heading', { level: 3 }).textContent).toBe(
      'Untitled',
    )
  })
})
