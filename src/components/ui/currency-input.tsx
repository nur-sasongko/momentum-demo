import * as React from 'react'

import { cn } from '#/libs/utils'
import {
  formatNumberWithSeparators,
  parseFormattedNumber,
} from '#/utils/currency'
import { inputClassName } from './input'

const DEFAULT_LOCALE = 'en-US'
const DEFAULT_DECIMAL_SCALE = 2

function sanitizeDigits(raw: string): string {
  let seenDot = false
  let result = ''
  for (const ch of raw) {
    if (ch >= '0' && ch <= '9') {
      result += ch
    } else if (ch === '.' && !seenDot) {
      seenDot = true
      result += ch
    }
  }
  return result
}

function formatLive(raw: string, locale: string, decimalScale: number): string {
  const sanitized = sanitizeDigits(raw)
  const dotIndex = sanitized.indexOf('.')
  const hasDot = dotIndex !== -1
  const integerPart = hasDot ? sanitized.slice(0, dotIndex) : sanitized
  const decimalPart = hasDot
    ? sanitized.slice(dotIndex + 1, dotIndex + 1 + decimalScale)
    : undefined

  const groupedInteger =
    integerPart === ''
      ? ''
      : new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(
          Number(integerPart),
        )

  return decimalPart === undefined
    ? groupedInteger
    : `${groupedInteger}.${decimalPart}`
}

// Counts digits and (at most) one decimal point up to `upToIndex`, ignoring
// grouping separators — used to keep the caret anchored to the same digit
// across a reformat rather than jumping to the end of the input.
function countSignificant(str: string, upToIndex: number): number {
  let count = 0
  let seenDot = false
  const end = Math.min(upToIndex, str.length)
  for (let i = 0; i < end; i++) {
    const ch = str[i]
    if (ch >= '0' && ch <= '9') {
      count++
    } else if (ch === '.' && !seenDot) {
      seenDot = true
      count++
    }
  }
  return count
}

function indexAtSignificant(str: string, targetCount: number): number {
  let count = 0
  let seenDot = false
  for (let i = 0; i < str.length; i++) {
    if (count === targetCount) return i
    const ch = str[i]
    if (ch >= '0' && ch <= '9') {
      count++
    } else if (ch === '.' && !seenDot) {
      seenDot = true
      count++
    }
  }
  return str.length
}

export interface CurrencyInputProps extends Omit<
  React.ComponentProps<'input'>,
  'value' | 'onChange' | 'type' | 'ref'
> {
  value: number | undefined
  onValueChange: (value: number | undefined) => void
  locale?: string
  decimalScale?: number
}

function CurrencyInput({
  className,
  value,
  onValueChange,
  locale = DEFAULT_LOCALE,
  decimalScale = DEFAULT_DECIMAL_SCALE,
  onFocus,
  onBlur,
  onKeyDown,
  ...props
}: CurrencyInputProps) {
  const inputRef = React.useRef<HTMLInputElement>(null)
  const isFocusedRef = React.useRef(false)
  const lastKeyRef = React.useRef<string | null>(null)
  const pendingCaretRef = React.useRef<number | null>(null)

  const [displayValue, setDisplayValue] = React.useState(() =>
    value === undefined
      ? ''
      : formatNumberWithSeparators(value, { locale, decimalScale }),
  )

  React.useEffect(() => {
    if (isFocusedRef.current) return
    setDisplayValue(
      value === undefined
        ? ''
        : formatNumberWithSeparators(value, { locale, decimalScale }),
    )
  }, [value, locale, decimalScale])

  React.useLayoutEffect(() => {
    if (pendingCaretRef.current === null || !inputRef.current) return
    const caretIndex = indexAtSignificant(displayValue, pendingCaretRef.current)
    inputRef.current.setSelectionRange(caretIndex, caretIndex)
    pendingCaretRef.current = null
  }, [displayValue])

  return (
    <input
      ref={inputRef}
      type="text"
      inputMode="decimal"
      data-slot="currency-input"
      className={cn(inputClassName, className)}
      {...props}
      value={displayValue}
      onKeyDown={(e) => {
        lastKeyRef.current = e.key
        onKeyDown?.(e)
      }}
      onChange={(e) => {
        const raw = e.target.value
        const caret = e.target.selectionStart ?? raw.length

        let effectiveRaw = raw
        let effectiveCaret = caret

        // Backspacing over a separator ("1,|234" -> "1|234") removes only the
        // punctuation, not a digit — collapse the preceding digit too so the
        // number actually shrinks.
        if (
          lastKeyRef.current === 'Backspace' &&
          raw.length === displayValue.length - 1
        ) {
          const removedChar = displayValue[caret]
          if (removedChar && !/[\d.]/.test(removedChar)) {
            effectiveRaw = raw.slice(0, caret - 1) + raw.slice(caret)
            effectiveCaret = caret - 1
          }
        }

        const significantBefore = countSignificant(effectiveRaw, effectiveCaret)
        const formatted = formatLive(effectiveRaw, locale, decimalScale)

        pendingCaretRef.current = significantBefore
        setDisplayValue(formatted)
        onValueChange(parseFormattedNumber(formatted))
      }}
      onFocus={(e) => {
        isFocusedRef.current = true
        onFocus?.(e)
      }}
      onBlur={(e) => {
        isFocusedRef.current = false
        setDisplayValue(
          value === undefined
            ? ''
            : formatNumberWithSeparators(value, { locale, decimalScale }),
        )
        onBlur?.(e)
      }}
    />
  )
}

export { CurrencyInput }
