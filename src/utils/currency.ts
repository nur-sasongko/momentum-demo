/**
 * Shared currency/number formatting and parsing helpers.
 *
 * @module utils/currency
 */

const DEFAULT_LOCALE = 'en-US'
const DEFAULT_DECIMAL_SCALE = 2

export interface FormatNumberOptions {
  locale?: string
  decimalScale?: number
}

/**
 * Formats a number with locale-aware thousands separators.
 *
 * @example
 * formatNumberWithSeparators(1234.5) // "1,234.50"
 */
export function formatNumberWithSeparators(
  value: number,
  {
    locale = DEFAULT_LOCALE,
    decimalScale = DEFAULT_DECIMAL_SCALE,
  }: FormatNumberOptions = {},
): string {
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: decimalScale,
    maximumFractionDigits: decimalScale,
  }).format(value)
}

/**
 * Parses a formatted number string back into a plain number, stripping
 * thousands separators and any non-numeric characters.
 *
 * @returns `undefined` when the input has no parseable digits.
 *
 * @example
 * parseFormattedNumber("1,234.50") // 1234.5
 * parseFormattedNumber("")         // undefined
 */
export function parseFormattedNumber(raw: string): number | undefined {
  const cleaned = raw.replace(/,/g, '').replace(/[^\d.]/g, '')
  if (cleaned === '' || cleaned === '.') return undefined

  const value = Number(cleaned)
  return Number.isNaN(value) ? undefined : value
}
