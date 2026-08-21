import { fireEvent, render, screen } from '@testing-library/react'
import type { ComponentProps } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { NoteOutline, NoteOutlineMobileMenu } from '../note-outline'
import { useNotesStore } from '#/stores/notes-store'

import type { OutlineEntry } from '#/routes/_authenticated/notes/-types/notes-outline'

let isMobile = false
vi.mock('#/hooks/use-mobile', () => ({
  useIsMobile: () => isMobile,
}))

let isWide = true
vi.mock('#/hooks/use-is-wide', () => ({
  useIsWide: () => isWide,
}))

const ENTRIES: OutlineEntry[] = [
  { level: 1, text: 'Intro', domIndex: 0 },
  { level: 2, text: 'Setup', domIndex: 1 },
  { level: 3, text: 'Env vars', domIndex: 2 },
]

function renderOutline(
  overrides: Partial<ComponentProps<typeof NoteOutline>> = {},
) {
  const onSelect = vi.fn()
  const utils = render(
    <NoteOutline
      entries={ENTRIES}
      activeIndex={0}
      progress={42}
      isReadOnly={false}
      onSelect={onSelect}
      {...overrides}
    />,
  )
  return { ...utils, onSelect }
}

beforeEach(() => {
  isMobile = false
  isWide = true
  useNotesStore.setState({ isOutlineCollapsed: false })
  // jsdom has no `ResizeObserver`; `TruncatedText` (the row labels) needs one.
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
  vi.clearAllMocks()
  vi.unstubAllGlobals()
})

describe('NoteOutline', () => {
  it('renders one button per entry, labelled with the heading text', () => {
    renderOutline()

    expect(screen.getByRole('button', { name: 'Intro' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Setup' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Env vars' })).toBeTruthy()
  })

  it('renders only the margin rule when entries is empty, at md and up', () => {
    const { container } = renderOutline({ entries: [] })

    expect(container.querySelector('aside')).toBeTruthy()
    expect(screen.queryByRole('navigation')).toBeNull()
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('renders nothing at all below md, regardless of entries', () => {
    isMobile = true
    const { container } = renderOutline()

    expect(container.innerHTML).toBe('')
  })

  it('keeps the structural w-6 gutter width when a note has no headings', () => {
    const { container } = renderOutline({ entries: [] })

    expect(container.querySelector('aside')?.className).toContain('w-6')
  })

  it('carries no title attribute on any row', () => {
    renderOutline()

    for (const button of screen.getAllByRole('button')) {
      expect(button.hasAttribute('title')).toBe(false)
    }
  })

  it('shows a static outline glyph, not a toggle, between md and xl', () => {
    isWide = false
    const { container } = renderOutline()

    expect(screen.queryByRole('button', { name: 'Hide outline' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Show outline' })).toBeNull()
    expect(container.querySelector('svg[aria-hidden="true"]')).toBeTruthy()
  })

  it('keeps the collapse toggle visible in the gutter head slot once collapsed', () => {
    useNotesStore.setState({ isOutlineCollapsed: true })
    renderOutline()

    const toggle = screen.getByRole('button', { name: 'Show outline' })
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
  })

  it('marks the active entry with aria-current="location" and no other entry', () => {
    renderOutline({ activeIndex: 1 })

    expect(
      screen
        .getByRole('button', { name: 'Setup' })
        .getAttribute('aria-current'),
    ).toBe('location')
    expect(
      screen
        .getByRole('button', { name: 'Intro' })
        .getAttribute('aria-current'),
    ).toBeNull()
    expect(
      screen
        .getByRole('button', { name: 'Env vars' })
        .getAttribute('aria-current'),
    ).toBeNull()
  })

  it('clicking an entry on a read-only note scrolls without placing the cursor', () => {
    const { onSelect } = renderOutline({ isReadOnly: true })

    fireEvent.click(screen.getByRole('button', { name: 'Setup' }))

    expect(onSelect).toHaveBeenCalledWith(1, { placeCursor: false })
  })

  it('clicking an entry on an editable note scrolls and places the cursor', () => {
    const { onSelect } = renderOutline({ isReadOnly: false })

    fireEvent.click(screen.getByRole('button', { name: 'Setup' }))

    expect(onSelect).toHaveBeenCalledWith(1, { placeCursor: true })
  })

  it('the collapse toggle flips aria-expanded and writes isOutlineCollapsed to the store', () => {
    renderOutline()

    const toggle = screen.getByRole('button', { name: 'Hide outline' })
    expect(toggle.getAttribute('aria-expanded')).toBe('true')

    fireEvent.click(toggle)

    expect(useNotesStore.getState().isOutlineCollapsed).toBe(true)
    expect(
      screen
        .getByRole('button', { name: 'Show outline' })
        .getAttribute('aria-expanded'),
    ).toBe('false')
  })

  it('does not render the collapse toggle when the viewport forces the gutter state', () => {
    isWide = false
    renderOutline()

    expect(screen.queryByRole('button', { name: 'Hide outline' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Show outline' })).toBeNull()
  })
})

function renderMobileMenu(
  overrides: Partial<ComponentProps<typeof NoteOutlineMobileMenu>> = {},
) {
  const onSelect = vi.fn()
  const utils = render(
    <NoteOutlineMobileMenu
      entries={ENTRIES}
      activeIndex={0}
      progress={42}
      isReadOnly={false}
      isRaised={false}
      onSelect={onSelect}
      {...overrides}
    />,
  )
  return { ...utils, onSelect }
}

describe('NoteOutlineMobileMenu', () => {
  beforeEach(() => {
    isMobile = true
  })

  it('renders nothing when entries is empty', () => {
    const { container } = renderMobileMenu({ entries: [] })

    expect(container.innerHTML).toBe('')
  })

  it('renders nothing above the mobile breakpoint', () => {
    isMobile = false
    const { container } = renderMobileMenu()

    expect(container.innerHTML).toBe('')
  })

  it('sits at bottom-6 by default and lifts to bottom-24 while the save bar shows', () => {
    const { rerender } = renderMobileMenu({ isRaised: false })
    const trigger = () => screen.getByRole('button', { name: 'Outline' })

    expect(trigger().className).toContain('bottom-6')
    expect(trigger().className).not.toContain('bottom-24')

    rerender(
      <NoteOutlineMobileMenu
        entries={ENTRIES}
        activeIndex={0}
        progress={42}
        isReadOnly={false}
        isRaised
        onSelect={vi.fn()}
      />,
    )

    expect(trigger().className).toContain('bottom-24')
  })

  it('opens a popover above the button listing every entry and the read-progress percentage', () => {
    renderMobileMenu({ progress: 42 })

    fireEvent.click(screen.getByRole('button', { name: 'Outline' }))

    expect(screen.getByText('42%')).toBeTruthy()
    expect(screen.getByText('Intro')).toBeTruthy()
    expect(screen.getByText('Setup')).toBeTruthy()
    expect(screen.getByText('Env vars')).toBeTruthy()
  })

  it('selecting an entry calls onSelect and closes the popover', () => {
    const { onSelect } = renderMobileMenu({ isReadOnly: true })

    fireEvent.click(screen.getByRole('button', { name: 'Outline' }))
    fireEvent.click(screen.getByText('Setup'))

    expect(onSelect).toHaveBeenCalledWith(1, { placeCursor: false })
    expect(screen.queryByText('Env vars')).toBeNull()
  })
})
