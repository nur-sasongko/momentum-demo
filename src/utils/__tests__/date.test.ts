import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  endOfDayIso,
  formatDateTimeLabel,
  formatMonthLabel,
  formatTodayDate,
  formatTransactionDate,
  getCurrentMonthKey,
  getDaysInRange,
  getLast7Days,
  hasExplicitTime,
  toDateKey,
  toDayKey,
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

describe('hasExplicitTime', () => {
  it('returns false for undefined', () => {
    expect(hasExplicitTime(undefined)).toBe(false)
  })

  it('returns false for local midnight', () => {
    const iso = new Date(2026, 6, 29, 0, 0, 0, 0).toISOString()
    expect(hasExplicitTime(iso)).toBe(false)
  })

  it('returns true when a time other than midnight is set', () => {
    const iso = new Date(2026, 6, 29, 14, 30, 0, 0).toISOString()
    expect(hasExplicitTime(iso)).toBe(true)
  })
})

describe('formatDateTimeLabel', () => {
  it('omits the time when none was explicitly set', () => {
    const iso = new Date(2026, 6, 29, 0, 0, 0, 0).toISOString()
    expect(formatDateTimeLabel(iso)).toBe('Jul 29')
  })

  it('includes the time when one was explicitly set', () => {
    const iso = new Date(2026, 6, 29, 14, 30, 0, 0).toISOString()
    expect(formatDateTimeLabel(iso)).toBe('Jul 29, 2:30 PM')
  })
})

describe('endOfDayIso', () => {
  it('returns the end of the given local day', () => {
    expect(endOfDayIso('2026-07-29')).toBe(
      new Date(2026, 6, 29, 23, 59, 59, 999).toISOString(),
    )
  })
})

describe('toDayKey', () => {
  it('truncates a UTC-noon ISO datetime to its local calendar day', () => {
    expect(toDayKey('2026-07-29T12:00:00.000Z')).toBe('2026-07-29')
  })

  it('truncates a locally-constructed ISO datetime to the same day', () => {
    const iso = new Date(2026, 6, 29, 14, 30, 0, 0).toISOString()
    expect(toDayKey(iso)).toBe('2026-07-29')
  })
})

describe('getDaysInRange', () => {
  it('returns every day between from and to, inclusive, oldest first', () => {
    expect(getDaysInRange('2026-07-01', '2026-07-03')).toEqual([
      '2026-07-01',
      '2026-07-02',
      '2026-07-03',
    ])
  })

  it('returns a single-day array when from equals to', () => {
    expect(getDaysInRange('2026-07-15', '2026-07-15')).toEqual(['2026-07-15'])
  })
})
