import { describe, expect, it } from 'vitest'

import { buildNotesListQueryParams } from '../notes-queries'

describe('buildNotesListQueryParams', () => {
  it('has no tag filter when there are no active tags and untagged is off', () => {
    const result = buildNotesListQueryParams({
      activeTags: [],
      tagFilterMode: 'OR',
      untaggedOnly: false,
      sortBy: 'updated-desc',
    })
    expect(result.tagFilter).toEqual({ kind: 'none' })
  })

  it('produces an untagged filter when untaggedOnly is set', () => {
    const result = buildNotesListQueryParams({
      activeTags: ['Work'],
      tagFilterMode: 'OR',
      untaggedOnly: true,
      sortBy: 'updated-desc',
    })
    expect(result.tagFilter).toEqual({ kind: 'untagged' })
  })

  it('produces an overlaps filter in OR mode', () => {
    const result = buildNotesListQueryParams({
      activeTags: ['Work', 'Ideas'],
      tagFilterMode: 'OR',
      untaggedOnly: false,
      sortBy: 'updated-desc',
    })
    expect(result.tagFilter).toEqual({
      kind: 'overlaps',
      tags: ['Work', 'Ideas'],
    })
  })

  it('produces a contains filter in AND mode', () => {
    const result = buildNotesListQueryParams({
      activeTags: ['Work', 'Ideas'],
      tagFilterMode: 'AND',
      untaggedOnly: false,
      sortBy: 'updated-desc',
    })
    expect(result.tagFilter).toEqual({
      kind: 'contains',
      tags: ['Work', 'Ideas'],
    })
  })

  it.each([
    ['updated-desc', 'updated_at', false],
    ['created-desc', 'created_at', false],
    ['title-asc', 'title', true],
    ['title-desc', 'title', false],
  ] as const)(
    'maps sortBy %s to %s ascending=%s',
    (sortBy, column, ascending) => {
      const result = buildNotesListQueryParams({
        activeTags: [],
        tagFilterMode: 'OR',
        untaggedOnly: false,
        sortBy,
      })
      expect(result.order).toEqual([{ column, ascending }])
    },
  )
})
