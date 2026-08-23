import { fireEvent, render, screen, within } from '@testing-library/react'
import type { ComponentProps } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { NoteByline } from '../note-byline'
import { useNoteTagsQuery } from '../../-utils/notes-queries'
import { useNotesFilters } from '../../-utils/use-notes-filters'

import type { Note } from '#/stores/notes-store'

vi.mock('../../-utils/notes-queries', () => ({
  useNoteTagsQuery: vi.fn(),
}))

vi.mock('../../-utils/use-notes-filters', () => ({
  useNotesFilters: vi.fn(),
}))

let toggleActiveTag: ReturnType<typeof vi.fn>

function makeNote(overrides: Partial<Note> = {}): Note {
  return {
    id: 'note-1',
    title: 'Untitled',
    excerpt: '',
    content: { type: 'doc', content: [{ type: 'paragraph' }] },
    tags: ['spec', 'q3'],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    isFavorite: false,
    isReadOnly: false,
    ...overrides,
  }
}

function renderByline(
  overrides: Partial<ComponentProps<typeof NoteByline>> = {},
) {
  const onTagsChange = vi.fn()
  const utils = render(
    <NoteByline
      note={makeNote()}
      wordCount={412}
      saveState="idle"
      isDirty={false}
      onTagsChange={onTagsChange}
      {...overrides}
    />,
  )
  return { ...utils, onTagsChange }
}

beforeEach(() => {
  toggleActiveTag = vi.fn()
  vi.mocked(useNotesFilters).mockReturnValue({
    toggleActiveTag,
  } as unknown as ReturnType<typeof useNotesFilters>)
  vi.mocked(useNoteTagsQuery).mockReturnValue({
    data: [
      { tag: 'spec', noteCount: 12 },
      { tag: 'q3', noteCount: 8 },
    ],
  } as unknown as ReturnType<typeof useNoteTagsQuery>)

  // jsdom has no `ResizeObserver`; `TagPicker`'s rows (opened via `＋`) use
  // `TruncatedText`, which needs one.
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

describe('NoteByline', () => {
  it('renders the edited time, creation date, and word count', () => {
    vi.useFakeTimers()
    // Constructed via local components and round-tripped through
    // `toISOString`, so the assertion holds regardless of the runner's
    // timezone — the same pattern `date.test.ts` uses for
    // `formatDateTimeLabel`.
    const createdAt = new Date(2026, 0, 1, 0, 0, 0, 0)
    vi.setSystemTime(new Date(2026, 0, 1, 2, 0, 0, 0))

    renderByline({
      note: makeNote({
        createdAt: createdAt.toISOString(),
        updatedAt: createdAt.toISOString(),
      }),
    })

    expect(screen.getByText(/^Edited /).textContent).toBe(
      'Edited 2 hours ago · Created Jan 1 · 412 words',
    )
    vi.useRealTimers()
  })

  it('includes the year in the creation date when it differs from the current year', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 7, 21, 0, 0, 0, 0))
    const createdAt = new Date(2025, 7, 12, 0, 0, 0, 0)

    renderByline({
      note: makeNote({ createdAt: createdAt.toISOString() }),
    })

    expect(screen.getByText(/^Edited /).textContent).toContain(
      'Created Aug 12, 2025',
    )
    vi.useRealTimers()
  })

  it('shows the exact created and edited timestamps in a tooltip', () => {
    const createdAt = new Date(2026, 0, 1, 9, 41, 0, 0)
    const updatedAt = new Date(2026, 0, 5, 14, 3, 0, 0)

    renderByline({
      note: makeNote({
        createdAt: createdAt.toISOString(),
        updatedAt: updatedAt.toISOString(),
      }),
    })

    fireEvent.focus(screen.getByText(/^Edited /))

    // Scoped to the tooltip content itself: the byline's own trigger line
    // also contains the bare words "Created"/"Edited", and Radix's
    // `TooltipContent` additionally renders a visually-hidden accessible
    // duplicate of its children (see `@radix-ui/react-tooltip`'s
    // `VisuallyHiddenContentContextProvider`) — so each label/value below
    // exists twice inside the tooltip alone. `getAllByText` + a length
    // assertion tolerates that duplication instead of asserting on document
    // order or DOM structure that isn't this component's concern.
    const tooltipContent = document.querySelector(
      '[data-slot="tooltip-content"]',
    )
    if (!(tooltipContent instanceof HTMLElement)) {
      throw new Error('tooltip content not found')
    }
    expect(
      within(tooltipContent).getAllByText('Created').length,
    ).toBeGreaterThan(0)
    // `formatExactTimestamp` intentionally emits a double space before the
    // time (see `date.ts`'s doc comment). RTL's text matcher normalizes the
    // *node's* text (collapsing runs of whitespace to one space) but never
    // normalizes the literal query string passed to `getByText` — so the
    // query itself has to already be in normalized (single-space) form or it
    // can never match, regardless of what's actually rendered.
    expect(
      within(tooltipContent).getAllByText('Jan 1, 2026 9:41 AM').length,
    ).toBeGreaterThan(0)
    expect(
      within(tooltipContent).getAllByText('Edited').length,
    ).toBeGreaterThan(0)
    expect(
      within(tooltipContent).getAllByText('Jan 5, 2026 2:03 PM').length,
    ).toBeGreaterThan(0)
  })

  it('hides the save indicator below the `sm` breakpoint', () => {
    renderByline({ saveState: 'idle', isDirty: true })

    const status = screen.getByTestId('note-byline-status')
    expect(status.className).toContain('hidden')
    expect(status.className).toContain('sm:inline')
  })

  it('renders each tag as a clickable #tag button', () => {
    renderByline()

    expect(screen.getByText('#spec')).toBeTruthy()
    expect(screen.getByText('#q3')).toBeTruthy()
  })

  it('clicking a tag adds it to the list filter via toggleActiveTag', () => {
    renderByline()

    fireEvent.click(screen.getByText('#spec'))

    expect(toggleActiveTag).toHaveBeenCalledWith('spec')
  })

  it('shows the add-tag trigger for an editable note', () => {
    renderByline({ note: makeNote({ isReadOnly: false }) })

    expect(screen.getByLabelText('Add tag')).toBeTruthy()
  })

  it('hides the add-tag trigger for a read-only note', () => {
    renderByline({ note: makeNote({ isReadOnly: true }) })

    expect(screen.queryByLabelText('Add tag')).toBeNull()
  })

  it('shows "No tags" for a read-only note with no tags', () => {
    renderByline({ note: makeNote({ isReadOnly: true, tags: [] }) })

    expect(screen.getByText('No tags')).toBeTruthy()
  })

  it('toggling a tag off in the picker removes it via onTagsChange', () => {
    const { onTagsChange } = renderByline()

    fireEvent.click(screen.getByLabelText('Add tag'))
    const specCheckbox = screen.getAllByRole('checkbox')[0]
    fireEvent.click(specCheckbox)

    expect(onTagsChange).toHaveBeenCalledWith(['q3'])
  })

  it('shows no save status when idle and not dirty', () => {
    renderByline({ saveState: 'idle', isDirty: false })

    expect(screen.queryByTestId('note-byline-status')).toBeNull()
  })

  it('the save status changes without altering the metadata text node', () => {
    const { rerender } = renderByline({ saveState: 'idle', isDirty: false })
    const meta = screen.getByText(/^Edited /).textContent

    rerender(
      <NoteByline
        note={makeNote()}
        wordCount={412}
        saveState="saving"
        isDirty
        onTagsChange={vi.fn()}
      />,
    )

    expect(screen.getByTestId('note-byline-status').textContent).toBe('Saving…')
    expect(screen.getByText(/^Edited /).textContent).toBe(meta)
  })
})
