import { useEffect, useState } from 'react'
import { format, set } from 'date-fns'
import { Button } from '#/components/ui/button'
import { Calendar } from '#/components/ui/calendar'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '#/components/ui/dialog'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { hasExplicitTime } from '../-utils/tasks-utils'

interface DeadlinePickerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  value?: string
  onSave: (isoDeadline: string) => void
}

export function DeadlinePickerDialog({
  open,
  onOpenChange,
  value,
  onSave,
}: DeadlinePickerDialogProps) {
  const [date, setDate] = useState<Date | undefined>(
    value ? new Date(value) : new Date(),
  )
  const [time, setTime] = useState(
    value && hasExplicitTime(value) ? format(new Date(value), 'HH:mm') : '',
  )

  useEffect(() => {
    if (open) {
      setDate(value ? new Date(value) : new Date())
      setTime(
        value && hasExplicitTime(value) ? format(new Date(value), 'HH:mm') : '',
      )
    }
  }, [open, value])

  const handleSave = () => {
    if (!date) return

    const [hours, minutes] = time ? time.split(':').map(Number) : [0, 0]
    const combined = set(date, { hours, minutes, seconds: 0, milliseconds: 0 })
    onSave(combined.toISOString())
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Set deadline</DialogTitle>
          <DialogDescription>
            Choose a date and, optionally, a specific time
          </DialogDescription>
        </DialogHeader>

        <Calendar
          mode="single"
          selected={date}
          onSelect={setDate}
          className="mx-auto"
        />

        <div className="space-y-2">
          <Label htmlFor="deadline-time">Time (optional)</Label>
          <Input
            id="deadline-time"
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!date}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
