import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  endOfDayIso,
  formatDateTimeLabel,
  formatExactTimestamp,
  formatMonthLabel,
  formatShortDate,
  formatTimeSince,
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

describe('formatTimeSince', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(FIXED_DATE)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns "just now" for a timestamp under a minute old', () => {
    expect(
      formatTimeSince(new Date(FIXED_DATE.getTime() - 30_000).toISOString()),
    ).toBe('just now')
  })

  it('returns a singular minute label at exactly one minute', () => {
    expect(
      formatTimeSince(new Date(FIXED_DATE.getTime() - 60_000).toISOString()),
    ).toBe('1 minute')
  })

  it('returns a plural minutes label under an hour', () => {
    expect(
      formatTimeSince(
        new Date(FIXED_DATE.getTime() - 5 * 60_000).toISOString(),
      ),
    ).toBe('5 minutes')
  })

  it('returns a singular hour label at exactly one hour', () => {
    expect(
      formatTimeSince(
        new Date(FIXED_DATE.getTime() - 60 * 60_000).toISOString(),
      ),
    ).toBe('1 hour')
  })

  it('returns a plural hours label under a day', () => {
    expect(
      formatTimeSince(
        new Date(FIXED_DATE.getTime() - 3 * 60 * 60_000).toISOString(),
      ),
    ).toBe('3 hours')
  })

  it('returns a singular day label at exactly one day', () => {
    expect(
      formatTimeSince(
        new Date(FIXED_DATE.getTime() - 24 * 60 * 60_000).toISOString(),
      ),
    ).toBe('1 day')
  })

  it('returns a plural days label beyond a day', () => {
    expect(
      formatTimeSince(
        new Date(FIXED_DATE.getTime() - 2 * 24 * 60 * 60_000).toISOString(),
      ),
    ).toBe('2 days')
  })

  it('never appends an "ago" suffix', () => {
    expect(
      formatTimeSince(
        new Date(FIXED_DATE.getTime() - 5 * 60_000).toISOString(),
      ),
    ).not.toContain('ago')
  })
})

describe('formatShortDate', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(FIXED_DATE)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('omits the year within the current year', () => {
    const date = new Date(2026, 7, 12, 9, 0, 0)
    expect(formatShortDate(date.toISOString())).toBe('Aug 12')
  })

  it('includes the year when it differs from the current year', () => {
    const date = new Date(2025, 7, 12, 9, 0, 0)
    expect(formatShortDate(date.toISOString())).toBe('Aug 12, 2025')
  })

  it('reads the year as of Jan 1, not Dec 31 of the prior year', () => {
    vi.setSystemTime(new Date(2027, 0, 1, 0, 0, 0))
    const date = new Date(2026, 11, 31, 23, 0, 0)
    expect(formatShortDate(date.toISOString())).toBe('Dec 31, 2026')
  })
})

describe('formatExactTimestamp', () => {
  it('renders a full, unambiguous timestamp', () => {
    const date = new Date(2026, 7, 12, 9, 41, 0)
    expect(formatExactTimestamp(date.toISOString())).toBe(
      'Aug 12, 2026  9:41 AM',
    )
  })

  it('renders an afternoon timestamp in 12-hour form', () => {
    const date = new Date(2026, 7, 12, 14, 3, 0)
    expect(formatExactTimestamp(date.toISOString())).toBe(
      'Aug 12, 2026  2:03 PM',
    )
  })
})
