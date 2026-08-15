import { describe, expect, it } from 'vitest'

import { daysUntilPurge, formatExpiryLabel } from '#/utils/archive'

describe('daysUntilPurge', () => {
  it('returns 30 for a just-archived row', () => {
    const now = new Date('2026-08-15T00:00:00.000Z')
    expect(daysUntilPurge('2026-08-15T00:00:00.000Z', now)).toBe(30)
  })

  it('returns 1 for a row archived 29 days ago', () => {
    const now = new Date('2026-08-15T00:00:00.000Z')
    expect(daysUntilPurge('2026-07-17T00:00:00.000Z', now)).toBe(1)
  })

  it('returns 0 for a row archived exactly 30 days ago', () => {
    const now = new Date('2026-08-15T00:00:00.000Z')
    expect(daysUntilPurge('2026-07-16T00:00:00.000Z', now)).toBe(0)
  })

  it('never goes negative for a row past the retention window', () => {
    const now = new Date('2026-08-15T00:00:00.000Z')
    expect(daysUntilPurge('2026-01-01T00:00:00.000Z', now)).toBe(0)
  })

  it('is stable across a DST boundary', () => {
    // US DST ends 2026-11-01 — this only matters if the calculation used
    // local calendar arithmetic instead of a raw millisecond difference.
    const now = new Date('2026-11-02T00:00:00.000Z')
    expect(daysUntilPurge('2026-10-03T00:00:00.000Z', now)).toBe(0)
  })
})

describe('formatExpiryLabel', () => {
  it('renders "in N days" well before expiry', () => {
    const now = new Date('2026-08-15T00:00:00.000Z')
    expect(formatExpiryLabel('2026-08-13T00:00:00.000Z', now)).toBe(
      'in 28 days',
    )
  })

  it('renders "tomorrow" with one day left', () => {
    const now = new Date('2026-08-15T00:00:00.000Z')
    expect(formatExpiryLabel('2026-07-17T00:00:00.000Z', now)).toBe('tomorrow')
  })

  it('renders "today" once the window has elapsed', () => {
    const now = new Date('2026-08-15T00:00:00.000Z')
    expect(formatExpiryLabel('2026-07-16T00:00:00.000Z', now)).toBe('today')
  })
})
