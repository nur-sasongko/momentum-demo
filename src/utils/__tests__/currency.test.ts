import { describe, expect, it } from 'vitest'
import {
  formatNumberWithSeparators,
  parseFormattedNumber,
} from '#/utils/currency'

describe('formatNumberWithSeparators', () => {
  it('formats whole numbers with thousands separators and two decimals', () => {
    expect(formatNumberWithSeparators(1234567)).toBe('1,234,567.00')
  })

  it('formats decimals to the default scale', () => {
    expect(formatNumberWithSeparators(1234.5)).toBe('1,234.50')
  })

  it('rounds beyond the default decimal scale', () => {
    expect(formatNumberWithSeparators(1234.567)).toBe('1,234.57')
  })

  it('formats zero', () => {
    expect(formatNumberWithSeparators(0)).toBe('0.00')
  })

  it('formats negative numbers', () => {
    expect(formatNumberWithSeparators(-1234.5)).toBe('-1,234.50')
  })

  it('respects a custom decimal scale', () => {
    expect(formatNumberWithSeparators(1234.5, { decimalScale: 0 })).toBe(
      '1,235',
    )
  })

  it('respects a custom locale', () => {
    expect(formatNumberWithSeparators(1234.5, { locale: 'id-ID' })).toBe(
      '1.234,50',
    )
  })
})

describe('parseFormattedNumber', () => {
  it('parses a comma-separated formatted string', () => {
    expect(parseFormattedNumber('1,234.50')).toBe(1234.5)
  })

  it('parses a plain integer string', () => {
    expect(parseFormattedNumber('1234')).toBe(1234)
  })

  it('strips stray non-numeric characters', () => {
    expect(parseFormattedNumber('$1,234.50abc')).toBe(1234.5)
  })

  it('returns undefined for an empty string', () => {
    expect(parseFormattedNumber('')).toBeUndefined()
  })

  it('returns undefined for a lone decimal point', () => {
    expect(parseFormattedNumber('.')).toBeUndefined()
  })

  it('returns undefined when there are no digits', () => {
    expect(parseFormattedNumber('abc')).toBeUndefined()
  })
})
