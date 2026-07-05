import { useState } from 'react'
import { Button } from '#/components/ui/button'
import { getTodayDeadline, getTomorrowDeadline } from '../-utils/tasks-utils'
import { DeadlinePickerDialog } from './deadline-picker-dialog'
import { ClockIcon } from 'lucide-react'

interface DeadlineQuickPicksProps {
  deadline?: string
  onChange: (deadline: string | undefined) => void
}

export function DeadlineQuickPicks({
  deadline,
  onChange,
}: DeadlineQuickPicksProps) {
  const [customOpen, setCustomOpen] = useState(false)

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        variant="outline"
        size="xs"
        onClick={() => onChange(getTodayDeadline())}
      >
        Today
      </Button>
      <Button
        variant="outline"
        size="xs"
        onClick={() => onChange(getTomorrowDeadline())}
      >
        Tomorrow
      </Button>
      <Button variant="outline" size="xs" onClick={() => setCustomOpen(true)}>
        <ClockIcon className="w-4 h-4 mr-1" />
      </Button>
      {deadline && (
        <Button variant="ghost" size="xs" onClick={() => onChange(undefined)}>
          Clear
        </Button>
      )}

      <DeadlinePickerDialog
        open={customOpen}
        onOpenChange={setCustomOpen}
        value={deadline}
        onSave={onChange}
      />
    </div>
  )
}
