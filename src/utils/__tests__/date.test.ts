import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  formatMonthLabel,
  formatTodayDate,
  formatTransactionDate,
  getCurrentMonthKey,
  getLast7Days,
  toDateKey,
  toMonthKey,
} from '#/utils/date'

const FIXED_DATE = new Date(2026, 4, 30, 12, 0, 0)

describe('formatTodayDate', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(FIXED_DATE)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns a readable date string for today', () => {
    expect(formatTodayDate()).toBe('Saturday, May 30')
  })
})

describe('toDateKey', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(FIXED_DATE)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns today as an ISO date key by default', () => {
    expect(toDateKey()).toBe('2026-05-30')
  })

  it('returns a past date key when offset is provided', () => {
    expect(toDateKey(3)).toBe('2026-05-27')
  })
})

describe('getLast7Days', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(FIXED_DATE)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns 7 days ending today with date keys and weekday labels', () => {
    const days = getLast7Days()

    expect(days).toHaveLength(7)
    expect(days[0]).toEqual({ dateKey: '2026-05-24', label: 'S' })
    expect(days[6]).toEqual({ dateKey: '2026-05-30', label: 'S' })
  })
})

describe('toMonthKey', () => {
  it('extracts YYYY-MM from an ISO date string', () => {
    expect(toMonthKey('2026-05-15')).toBe('2026-05')
  })
})

describe('getCurrentMonthKey', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(FIXED_DATE)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns the current month as YYYY-MM', () => {
    expect(getCurrentMonthKey()).toBe('2026-05')
  })
})

describe('formatMonthLabel', () => {
  it('formats a month key as a long month and year', () => {
    expect(formatMonthLabel('2026-05')).toBe('May 2026')
  })
})

describe('formatTransactionDate', () => {
  it('formats an ISO date key as a short month and day', () => {
    expect(formatTransactionDate('2026-05-15')).toBe('May 15')
  })
})

describe('date utility edge cases', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 0, 1, 12, 0, 0))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('keeps local month boundaries when offsetting date keys', () => {
    expect(toDateKey()).toBe('2026-01-01')
    expect(toDateKey(1)).toBe('2025-12-31')
  })

  it('formats January month keys consistently', () => {
    expect(formatMonthLabel('2026-01')).toBe('January 2026')
  })
})
