import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { NoteListItem } from '../note-list-item'

import type { NoteSummary } from '#/stores/notes-store'

// Render `Link` as a plain anchor so the row needs no router context; the
// `search` callback is resolved against an empty previous search.
vi.mock('@tanstack/react-router', () => ({
  Link: ({
    search,
    to,
    resetScroll: _resetScroll,
    ...props
  }: {
    search: (prev: Record<string, unknown>) => Record<string, unknown>
    to: string
    resetScroll?: boolean
  } & React.ComponentProps<'a'>) => (
    <a
      href={`${to}?${new URLSearchParams(search({}) as Record<string, string>)}`}
      {...props}
    />
  ),
}))

// jsdom has no `ResizeObserver`; `TruncatedText` (title, tag run) needs one.
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

function makeSummary(overrides: Partial<NoteSummary> = {}): NoteSummary {
  return {
    id: 'note-1',
    title: 'Q3 Planning',
    excerpt: 'Goals: ship habits, second brain MVP',
    tags: ['Work', 'Ideas'],
    isFavorite: false,
    isReadOnly: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('NoteListItem', () => {
  it('renders the title and excerpt', () => {
    render(<NoteListItem note={makeSummary()} isActive={false} />)

    expect(screen.getByText('Q3 Planning')).toBeTruthy()
    expect(
      screen.getByText('Goals: ship habits, second brain MVP'),
    ).toBeTruthy()
  })

  it('renders tags from the summary as one line of #tag text', () => {
    render(<NoteListItem note={makeSummary()} isActive={false} />)

    expect(screen.getByText('#Work #Ideas')).toBeTruthy()
  })

  it('shows the lock icon for a read-only note', () => {
    render(
      <NoteListItem
        note={makeSummary({ isReadOnly: true })}
        isActive={false}
      />,
    )

    expect(screen.getByLabelText('Read-only')).toBeTruthy()
  })

  it('shows the star icon for a favorited note', () => {
    render(
      <NoteListItem
        note={makeSummary({ isFavorite: true })}
        isActive={false}
      />,
    )

    expect(screen.getByLabelText('Favorited')).toBeTruthy()
  })

  it('renders as a link whose href carries the note id', () => {
    render(<NoteListItem note={makeSummary()} isActive={false} />)

    const link = screen.getByRole('link')
    expect(link.getAttribute('href')).toContain('note=note-1')
  })

  it('marks the active row with data-active and aria-current', () => {
    render(<NoteListItem note={makeSummary()} isActive />)

    const link = screen.getByRole('link')
    expect(link.getAttribute('data-active')).toBe('true')
    expect(link.getAttribute('aria-current')).toBe('page')
  })

  it('calls onSelect on a plain click', () => {
    const onSelect = vi.fn()
    render(
      <NoteListItem
        note={makeSummary()}
        isActive={false}
        onSelect={onSelect}
      />,
    )

    fireEvent.click(screen.getByRole('link'))

    expect(onSelect).toHaveBeenCalledTimes(1)
  })

  it.each([
    ['ctrl', { ctrlKey: true }],
    ['meta', { metaKey: true }],
    ['shift', { shiftKey: true }],
    ['alt', { altKey: true }],
    ['middle', { button: 1 }],
  ])('does not call onSelect on a %s click', (_name, init) => {
    const onSelect = vi.fn()
    render(
      <NoteListItem
        note={makeSummary()}
        isActive={false}
        onSelect={onSelect}
      />,
    )

    fireEvent.click(screen.getByRole('link'), init)

    expect(onSelect).not.toHaveBeenCalled()
  })
})
