import { useId, useState } from 'react'
import { format, set } from 'date-fns'
import { X } from 'lucide-react'

import { Button } from '#/components/ui/button'
import { Calendar } from '#/components/ui/calendar'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '#/components/ui/popover'
import { hasExplicitTime } from '#/utils/date'

interface DateTimePickerProps {
  /** ISO datetime string. */
  value: string
  onChange: (isoDate: string) => void
  /** Element that opens the popover — rendered via `PopoverTrigger asChild`. */
  trigger: React.ReactNode
  align?: 'start' | 'center' | 'end'
}

/**
 * A single popover combining a calendar and an optional time field, so
 * picking a date and time is one cohesive interaction instead of two
 * disconnected controls.
 */
export function DateTimePicker({
  value,
  onChange,
  trigger,
  align = 'start',
}: DateTimePickerProps) {
  const [open, setOpen] = useState(false)
  const timeInputId = useId()
  const current = value ? new Date(value) : undefined

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent className="w-auto space-y-3 p-3" align={align}>
        <Calendar
          mode="single"
          selected={current}
          onSelect={(date) => {
            if (!date) return
            const base = current ?? new Date()
            onChange(
              set(date, {
                hours: base.getHours(),
                minutes: base.getMinutes(),
                seconds: 0,
                milliseconds: 0,
              }).toISOString(),
            )
          }}
        />
        <div className="space-y-1.5 px-1">
          <Label
            htmlFor={timeInputId}
            className="text-xs text-muted-foreground"
          >
            Time (optional)
          </Label>
          <div className="flex items-center gap-2">
            <Input
              id={timeInputId}
              type="time"
              className="flex-1"
              value={
                current && hasExplicitTime(value)
                  ? format(current, 'HH:mm')
                  : ''
              }
              onChange={(e) => {
                const base = current ?? new Date()
                const [hours, minutes] = e.target.value
                  ? e.target.value.split(':').map(Number)
                  : [0, 0]
                onChange(
                  set(base, {
                    hours,
                    minutes,
                    seconds: 0,
                    milliseconds: 0,
                  }).toISOString(),
                )
              }}
            />
            {current && hasExplicitTime(value) && (
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Clear time"
                className="text-muted-foreground hover:text-foreground"
                onClick={() =>
                  onChange(
                    set(current, {
                      hours: 0,
                      minutes: 0,
                      seconds: 0,
                      milliseconds: 0,
                    }).toISOString(),
                  )
                }
              >
                <X className="size-3.5" />
              </Button>
            )}
            <Button type="button" size="sm" onClick={() => setOpen(false)}>
              Done
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
