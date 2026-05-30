import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { formatTodayDate } from '#/utils/date'

describe('formatTodayDate', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-30T00:00:00.000Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns a readable date string for today', () => {
    expect(formatTodayDate()).toBe('Saturday, May 30')
  })
})
