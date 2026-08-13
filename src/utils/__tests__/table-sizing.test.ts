import { describe, expect, it } from 'vitest'

import { clampColumnSizing, pruneColumnSizing } from '#/utils/table-sizing'

describe('pruneColumnSizing', () => {
  it('drops ids not present in the current column set and keeps the rest', () => {
    const result = pruneColumnSizing({ date: 150, note: 280, removed: 200 }, [
      'date',
      'note',
    ])
    expect(result).toEqual({ date: 150, note: 280 })
  })

  it('is a no-op on a fresh table with no persisted sizing', () => {
    expect(pruneColumnSizing({}, ['date', 'note'])).toEqual({})
  })
})

describe('clampColumnSizing', () => {
  it('raises a value below minSize', () => {
    const result = clampColumnSizing({ note: 10 }, [
      { id: 'note', minSize: 80, maxSize: 600 },
    ])
    expect(result).toEqual({ note: 80 })
  })

  it('lowers a value above maxSize', () => {
    const result = clampColumnSizing({ note: 900 }, [
      { id: 'note', minSize: 80, maxSize: 600 },
    ])
    expect(result).toEqual({ note: 600 })
  })

  it('leaves in-range values untouched', () => {
    const result = clampColumnSizing({ note: 300 }, [
      { id: 'note', minSize: 80, maxSize: 600 },
    ])
    expect(result).toEqual({ note: 300 })
  })

  it('leaves values for unknown columns untouched', () => {
    const result = clampColumnSizing({ ghost: 42 }, [])
    expect(result).toEqual({ ghost: 42 })
  })
})
