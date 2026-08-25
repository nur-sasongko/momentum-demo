import { useState } from 'react'
import { format, parseISO } from 'date-fns'
import { CalendarIcon, Download, Loader2, X } from 'lucide-react'
import type { DateRange as DayPickerDateRange } from 'react-day-picker'

import { Button } from '#/components/ui/button'
import { Calendar } from '#/components/ui/calendar'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '#/components/ui/popover'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '#/components/ui/tooltip'
import { useFinanceExport } from '../-utils/use-finance-export'
import { useFinanceFilters } from '../-utils/use-finance-filters'

function toStoreRange(range: DayPickerDateRange) {
  return {
    from: range.from ? format(range.from, 'yyyy-MM-dd') : null,
    to: range.to ? format(range.to, 'yyyy-MM-dd') : null,
  }
}

export function FinanceFilters() {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<DayPickerDateRange>({
    from: undefined,
    to: undefined,
  })

  const { dateRange, setDateRange } = useFinanceFilters()
  const {
    exportTransactions,
    isPending: isExporting,
    isEmpty,
  } = useFinanceExport()

  const hasRange = dateRange.from !== null || dateRange.to !== null

  function handleOpenChange(nextOpen: boolean) {
    if (nextOpen) {
      // Sync draft from committed store state when opening
      setDraft({
        from: dateRange.from ? parseISO(dateRange.from) : undefined,
        to: dateRange.to ? parseISO(dateRange.to) : undefined,
      })
    } else {
      // Commit draft to store only when the popover closes (user-initiated close)
      setDateRange(toStoreRange(draft))
    }
    setOpen(nextOpen)
  }

  function handleRangeSelect(range: DayPickerDateRange | undefined) {
    const next: DayPickerDateRange = range ?? { from: undefined, to: undefined }
    setDraft(next)

    // Auto-close only when a complete range spanning different days is selected.
    // Comparing timestamps avoids closing on first-click where react-day-picker
    // can temporarily set from === to on the same date.
    if (next.from && next.to && next.from.getTime() !== next.to.getTime()) {
      setDateRange(toStoreRange(next))
      setOpen(false)
    }
  }

  const rangeLabel = hasRange
    ? [
        dateRange.from && format(parseISO(dateRange.from), 'MMM d'),
        dateRange.to && format(parseISO(dateRange.to), 'MMM d'),
      ]
        .filter(Boolean)
        .join(' – ')
    : 'All time'

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Popover open={open} onOpenChange={handleOpenChange}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            <CalendarIcon className="size-4 sm:size-3.5" />
            <span>{rangeLabel}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="range"
            selected={draft}
            onSelect={handleRangeSelect}
            numberOfMonths={2}
            max={31}
          />
        </PopoverContent>
      </Popover>

      {hasRange && (
        <Button
          variant="ghost"
          size="sm"
          className="h-8 gap-1 text-xs text-muted-foreground hover:text-foreground"
          onClick={() => setDateRange({ from: null, to: null })}
        >
          <X className="size-3" />
          Clear
        </Button>
      )}

      <TooltipProvider delayDuration={300}>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="ml-auto">
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => void exportTransactions()}
                disabled={isExporting || isEmpty}
              >
                {isExporting ? (
                  <Loader2 className="size-4 animate-spin sm:size-3.5" />
                ) : (
                  <Download className="size-4 sm:size-3.5" />
                )}
                <span>{isExporting ? 'Exporting…' : 'Export'}</span>
              </Button>
            </span>
          </TooltipTrigger>
          {isEmpty && !isExporting && (
            <TooltipContent>No transactions to export</TooltipContent>
          )}
        </Tooltip>
      </TooltipProvider>
    </div>
  )
}
