import { describe, expect, it } from 'vitest'

import { stringArrayParam, toggleArrayValue } from '#/utils/search-params'

describe('stringArrayParam', () => {
  it('passes an array value through unchanged', () => {
    expect(stringArrayParam.parse(['a', 'b'])).toEqual(['a', 'b'])
  })

  it('wraps a bare scalar into a single-element array', () => {
    expect(stringArrayParam.parse('a')).toEqual(['a'])
  })

  it('defaults to an empty array when the value is undefined', () => {
    expect(stringArrayParam.parse(undefined)).toEqual([])
  })

  it('falls back to an empty array on a malformed value', () => {
    expect(stringArrayParam.parse([1, 2])).toEqual([])
  })
})

describe('toggleArrayValue', () => {
  it('adds a missing value to the list', () => {
    expect(toggleArrayValue(['a', 'b'], 'c')).toEqual({
      next: ['a', 'b', 'c'],
      isBoundary: false,
    })
  })

  it('removes a present value from the list', () => {
    expect(toggleArrayValue(['a', 'b', 'c'], 'b')).toEqual({
      next: ['a', 'c'],
      isBoundary: false,
    })
  })

  it('reports isBoundary true when adding to an empty list', () => {
    expect(toggleArrayValue([], 'a')).toEqual({
      next: ['a'],
      isBoundary: true,
    })
  })

  it('reports isBoundary true when removing the last item', () => {
    expect(toggleArrayValue(['a'], 'a')).toEqual({
      next: [],
      isBoundary: true,
    })
  })

  it('reports isBoundary false when the list stays non-empty either way', () => {
    expect(toggleArrayValue(['a', 'b'], 'a')).toEqual({
      next: ['b'],
      isBoundary: false,
    })
  })
})
