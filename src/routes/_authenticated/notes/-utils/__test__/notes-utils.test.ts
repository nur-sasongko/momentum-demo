import { describe, expect, it } from 'vitest'

import type { Note } from '#/stores/notes-store'
import {
  addTagsCaseInsensitive,
  filterNotes,
  normalizeTag,
} from '#/routes/_authenticated/notes/-utils/notes-utils'

function makeNote(overrides: Partial<Note>): Note {
  return {
    id: 'note',
    title: 'Title',
    content: { type: 'doc', content: [{ type: 'paragraph' }] },
    tags: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    isFavorite: false,
    isReadOnly: false,
    ...overrides,
  }
}

describe('normalizeTag', () => {
  it('trims whitespace', () => {
    expect(normalizeTag('  hello  ')).toBe('hello')
  })

  it('collapses internal whitespace', () => {
    expect(normalizeTag('a   b\tc')).toBe('a b c')
  })

  it('strips leading hash characters', () => {
    expect(normalizeTag('##tag')).toBe('tag')
  })

  it('caps length at 32 characters', () => {
    const long = 'a'.repeat(40)
    expect(normalizeTag(long)).toHaveLength(32)
  })

  it('returns empty string for blank input', () => {
    expect(normalizeTag('   ')).toBe('')
    expect(normalizeTag('#')).toBe('')
  })
})

describe('addTagsCaseInsensitive', () => {
  it('appends a new tag', () => {
    expect(addTagsCaseInsensitive(['a'], 'b')).toEqual(['a', 'b'])
  })

  it('does not duplicate when only casing differs', () => {
    expect(addTagsCaseInsensitive(['Work'], 'work')).toEqual(['Work'])
  })

  it('returns the same reference when duplicate', () => {
    const existing = ['Work']
    expect(addTagsCaseInsensitive(existing, 'WORK')).toBe(existing)
  })
})

describe('filterNotes', () => {
  const baseOpts = {
    query: '',
    activeTags: [] as string[],
    tagFilterMode: 'OR' as const,
    untaggedOnly: false,
    favoritesOnly: false,
    sortBy: 'updated-desc' as const,
  }

  const a = makeNote({
    id: 'a',
    title: 'Apple',
    tags: ['Work', 'Reading'],
    isFavorite: true,
    createdAt: '2026-01-05T00:00:00.000Z',
    updatedAt: '2026-01-10T00:00:00.000Z',
  })
  const b = makeNote({
    id: 'b',
    title: 'Banana',
    tags: ['Personal'],
    isFavorite: false,
    createdAt: '2026-01-08T00:00:00.000Z',
    updatedAt: '2026-01-09T00:00:00.000Z',
  })
  const c = makeNote({
    id: 'c',
    title: 'Cherry',
    tags: [],
    isFavorite: false,
    createdAt: '2026-01-02T00:00:00.000Z',
    updatedAt: '2026-01-11T00:00:00.000Z',
  })
  const d = makeNote({
    id: 'd',
    title: 'Date',
    tags: ['Reading'],
    isFavorite: true,
    createdAt: '2026-01-04T00:00:00.000Z',
    updatedAt: '2026-01-08T00:00:00.000Z',
  })
  const notes = [a, b, c, d]

  it('sorts by updated-desc by default', () => {
    const ids = filterNotes(notes, baseOpts).map((n) => n.id)
    expect(ids).toEqual(['c', 'a', 'b', 'd'])
  })

  it('sorts by created-desc', () => {
    const ids = filterNotes(notes, { ...baseOpts, sortBy: 'created-desc' }).map(
      (n) => n.id,
    )
    expect(ids).toEqual(['b', 'a', 'd', 'c'])
  })

  it('sorts by title ascending', () => {
    const ids = filterNotes(notes, { ...baseOpts, sortBy: 'title-asc' }).map(
      (n) => n.id,
    )
    expect(ids).toEqual(['a', 'b', 'c', 'd'])
  })

  it('sorts by title descending', () => {
    const ids = filterNotes(notes, { ...baseOpts, sortBy: 'title-desc' }).map(
      (n) => n.id,
    )
    expect(ids).toEqual(['d', 'c', 'b', 'a'])
  })

  it('filters by OR across multiple tags', () => {
    const ids = filterNotes(notes, {
      ...baseOpts,
      activeTags: ['Work', 'Personal'],
    }).map((n) => n.id)
    expect(ids).toEqual(['a', 'b'])
  })

  it('filters by AND across multiple tags', () => {
    const ids = filterNotes(notes, {
      ...baseOpts,
      activeTags: ['Work', 'Reading'],
      tagFilterMode: 'AND',
    }).map((n) => n.id)
    expect(ids).toEqual(['a'])
  })

  it('matches tags case-insensitively', () => {
    const ids = filterNotes(notes, {
      ...baseOpts,
      activeTags: ['reading'],
    }).map((n) => n.id)
    expect(ids).toEqual(['a', 'd'])
  })

  it('returns only untagged notes when untaggedOnly is set', () => {
    const ids = filterNotes(notes, { ...baseOpts, untaggedOnly: true }).map(
      (n) => n.id,
    )
    expect(ids).toEqual(['c'])
  })

  it('respects favoritesOnly', () => {
    const ids = filterNotes(notes, { ...baseOpts, favoritesOnly: true }).map(
      (n) => n.id,
    )
    expect(ids).toEqual(['a', 'd'])
  })

  it('combines favoritesOnly with tag filter', () => {
    const ids = filterNotes(notes, {
      ...baseOpts,
      favoritesOnly: true,
      activeTags: ['Reading'],
    }).map((n) => n.id)
    expect(ids).toEqual(['a', 'd'])
  })

  it('filters by query against title and tags', () => {
    const ids = filterNotes(notes, { ...baseOpts, query: 'work' }).map(
      (n) => n.id,
    )
    expect(ids).toEqual(['a'])
  })
})
