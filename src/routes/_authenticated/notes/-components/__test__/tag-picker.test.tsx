import { fireEvent, render, screen } from '@testing-library/react'
import type { ComponentProps } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { TagPicker } from '../tag-picker'

import type { NoteTagCount } from '#/routes/_authenticated/notes/-types/notes-query'

const COUNTS: NoteTagCount[] = [
  { tag: 'spec', noteCount: 12 },
  { tag: 'q3', noteCount: 8 },
  { tag: 'reading', noteCount: 5 },
]

// jsdom has no `ResizeObserver`; `TruncatedText` (each tag row) needs one.
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

function renderPicker(
  overrides: Partial<ComponentProps<typeof TagPicker>> = {},
) {
  const onToggle = vi.fn()
  const utils = render(
    <TagPicker
      selected={[]}
      counts={COUNTS}
      onToggle={onToggle}
      {...overrides}
    />,
  )
  return { ...utils, onToggle }
}

describe('TagPicker', () => {
  it('renders every tag with its note count', () => {
    renderPicker()

    expect(screen.getByText('spec')).toBeTruthy()
    expect(screen.getByText('12')).toBeTruthy()
    expect(screen.getByText('q3')).toBeTruthy()
    expect(screen.getByText('8')).toBeTruthy()
    expect(screen.getByText('reading')).toBeTruthy()
    expect(screen.getByText('5')).toBeTruthy()
  })

  it('checks the box for an already-selected tag only', () => {
    renderPicker({ selected: ['spec'] })

    // Document order matches `COUNTS`: spec, q3, reading.
    const [spec, q3, reading] = screen.getAllByRole('checkbox')
    expect(spec.getAttribute('data-state')).toBe('checked')
    expect(q3.getAttribute('data-state')).toBe('unchecked')
    expect(reading.getAttribute('data-state')).toBe('unchecked')
  })

  it('matches selection case-insensitively', () => {
    renderPicker({ selected: ['SPEC'] })

    expect(screen.getAllByRole('checkbox')[0].getAttribute('data-state')).toBe(
      'checked',
    )
  })

  it('filters the list as the search field changes', () => {
    renderPicker()

    fireEvent.change(screen.getByLabelText('Find a tag'), {
      target: { value: 'rea' },
    })

    expect(screen.getByText('reading')).toBeTruthy()
    expect(screen.queryByText('spec')).toBeNull()
    expect(screen.queryByText('q3')).toBeNull()
  })

  it('calls onToggle with the clicked tag', () => {
    const { onToggle } = renderPicker()

    fireEvent.click(screen.getAllByRole('checkbox')[0])

    expect(onToggle).toHaveBeenCalledWith('spec')
  })

  it('shows no Create row by default, even with unmatched search text', () => {
    renderPicker()

    fireEvent.change(screen.getByLabelText('Find a tag'), {
      target: { value: 'brand-new' },
    })

    expect(screen.queryByText('Create "brand-new"')).toBeNull()
  })

  it('shows a Create row when allowCreate is set and no tag matches', () => {
    renderPicker({ allowCreate: true })

    fireEvent.change(screen.getByLabelText('Find a tag'), {
      target: { value: 'brand-new' },
    })

    expect(screen.getByText('Create "brand-new"')).toBeTruthy()
  })

  it('hides the Create row when the query matches an existing tag case-insensitively', () => {
    renderPicker({ allowCreate: true })

    fireEvent.change(screen.getByLabelText('Find a tag'), {
      target: { value: 'SPEC' },
    })

    expect(screen.queryByText(/^Create /)).toBeNull()
  })

  it('calls onCreate with the canonicalized tag and clears the search field', () => {
    const onCreate = vi.fn()
    renderPicker({ allowCreate: true, onCreate })

    fireEvent.change(screen.getByLabelText('Find a tag'), {
      target: { value: 'brand-new' },
    })
    fireEvent.click(screen.getByText('Create "brand-new"'))

    expect(onCreate).toHaveBeenCalledWith('brand-new')
    expect(screen.getByLabelText('Find a tag').value).toBe('')
  })

  it('renders the footer content when provided', () => {
    renderPicker({ footer: <div>Clear all</div> })

    expect(screen.getByText('Clear all')).toBeTruthy()
  })

  it('shows an empty-library message when there are no tags at all', () => {
    renderPicker({ counts: [] })

    expect(screen.getByText('No tags yet')).toBeTruthy()
  })
})
