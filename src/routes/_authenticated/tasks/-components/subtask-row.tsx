import { useState } from 'react'
import { Clock, MoreVertical, Trash2 } from 'lucide-react'
import { Button } from '#/components/ui/button'
import { Checkbox } from '#/components/ui/checkbox'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '#/components/ui/dropdown-menu'
import { Textarea } from '#/components/ui/textarea'
import { cn } from '#/libs/utils'
import type { Subtask } from '#/stores/tasks-store'
import { useTasksStore } from '#/stores/tasks-store'
import {
  useDeleteSubtaskMutation,
  useToggleSubtaskMutation,
  useUpdateSubtaskMutation,
} from '../-utils/tasks-queries'
import {
  DEADLINE_COLOR_CLASSES,
  formatDeadlineLabel,
  getDeadlineColorState,
  hasExplicitTime,
} from '../-utils/tasks-utils'
import { DeadlineQuickPicks } from './deadline-quick-picks'

interface SubtaskRowProps {
  taskId: string
  subtask: Subtask
}

export function SubtaskRow({ taskId, subtask }: SubtaskRowProps) {
  const [expanded, setExpanded] = useState(false)
  const [notes, setNotes] = useState(subtask.notes || '')

  const toggleSubtask = useTasksStore((s) => s.toggleSubtask)
  const updateSubtask = useTasksStore((s) => s.updateSubtask)
  const toggleSubtaskMutation = useToggleSubtaskMutation()
  const updateSubtaskMutation = useUpdateSubtaskMutation()
  const deleteSubtaskMutation = useDeleteSubtaskMutation()

  const handleToggleComplete = () => {
    toggleSubtask(taskId, subtask.id)
    toggleSubtaskMutation.mutate({
      taskId,
      subtaskId: subtask.id,
      completed: !subtask.completed,
    })
  }

  const handleNotesBlur = () => {
    const trimmed = notes.trim()
    if (trimmed === (subtask.notes || '')) return
    const updates = { notes: trimmed || undefined }
    updateSubtask(taskId, subtask.id, updates)
    updateSubtaskMutation.mutate({ taskId, subtaskId: subtask.id, updates })
  }

  const handleDeadlineChange = (deadline: string | undefined) => {
    updateSubtask(taskId, subtask.id, { deadline })
    updateSubtaskMutation.mutate({
      taskId,
      subtaskId: subtask.id,
      updates: { deadline },
    })
  }

  const handleDelete = () => {
    deleteSubtaskMutation.mutate({ taskId, subtaskId: subtask.id })
  }

  const colorState = subtask.deadline
    ? getDeadlineColorState(subtask.deadline)
    : null

  return (
    <div>
      <div className="group flex items-center gap-2 py-1">
        <Checkbox
          checked={subtask.completed}
          onCheckedChange={handleToggleComplete}
          onClick={(e) => e.stopPropagation()}
          className="rounded-full border-zinc-400 dark:border-zinc-600"
        />
        <span
          className={cn(
            'min-w-0 flex-1 cursor-pointer truncate text-sm',
            subtask.completed &&
              'text-zinc-400 line-through dark:text-zinc-600',
          )}
          onClick={() => setExpanded((v) => !v)}
        >
          {subtask.title}
        </span>
        {subtask.deadline && (
          <span
            className={cn(
              'flex items-center gap-1 whitespace-nowrap text-xs',
              colorState && DEADLINE_COLOR_CLASSES[colorState],
            )}
          >
            {hasExplicitTime(subtask.deadline) && <Clock className="h-3 w-3" />}
            {formatDeadlineLabel(subtask.deadline)}
          </span>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              className="opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem variant="destructive" onClick={handleDelete}>
              <Trash2 className="h-4 w-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {expanded && (
        <div className="space-y-2 pb-2 pl-6">
          <Textarea
            placeholder="Add details..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={handleNotesBlur}
            rows={2}
            className="text-sm"
          />
          <DeadlineQuickPicks
            deadline={subtask.deadline}
            onChange={handleDeadlineChange}
          />
        </div>
      )}
    </div>
  )
}
