import { describe, expect, it } from 'vitest'

import {
  addTagsCaseInsensitive,
  canonicalizeTag,
  getExcerpt,
  normalizeTag,
} from '#/routes/_authenticated/notes/-utils/notes-utils'

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

describe('canonicalizeTag', () => {
  it('returns the existing tag casing on a case-insensitive match', () => {
    expect(canonicalizeTag('work', ['Work', 'Ideas'])).toBe('Work')
  })

  it('returns the normalized input when there is no match', () => {
    expect(canonicalizeTag('#Travel  ', ['Work'])).toBe('Travel')
  })
})

describe('getExcerpt', () => {
  it('returns the plain text unchanged when under the max length', () => {
    expect(getExcerpt('hello world')).toBe('hello world')
  })

  it('collapses whitespace and trims', () => {
    expect(getExcerpt('  hello   world  ')).toBe('hello world')
  })

  it('truncates at the max length with an ellipsis', () => {
    const long = 'word '.repeat(40).trim()
    const result = getExcerpt(long, 20)
    expect(result.endsWith('…')).toBe(true)
    expect(result.length).toBeLessThanOrEqual(21)
  })

  it('returns an empty string for empty plain text', () => {
    expect(getExcerpt('')).toBe('')
  })
})
