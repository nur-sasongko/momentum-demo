import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Clock, MoreVertical, Plus, Star, Trash2 } from 'lucide-react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Button } from '#/components/ui/button'
import { Checkbox } from '#/components/ui/checkbox'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '#/components/ui/dropdown-menu'
import { Badge } from '#/components/ui/badge'
import { Input } from '#/components/ui/input'
import { Textarea } from '#/components/ui/textarea'
import { cn } from '#/libs/utils'
import type { Task, TaskList } from '#/stores/tasks-store'
import { useTasksStore } from '#/stores/tasks-store'
import {
  useCreateSubtaskMutation,
  useDeleteTaskMutation,
  useUpdateTaskMutation,
} from '../-utils/tasks-queries'
import {
  DEADLINE_COLOR_CLASSES,
  formatDeadlineLabel,
  getDeadlineColorState,
  getNextOrder,
  hasExplicitTime,
} from '../-utils/tasks-utils'
import { DeadlineQuickPicks } from './deadline-quick-picks'
import { SubtaskRow } from './subtask-row'

interface TaskRowProps {
  task: Task
  disableDrag?: boolean
  list?: TaskList
}

export function TaskRow({ task, disableDrag, list }: TaskRowProps) {
  const [expanded, setExpanded] = useState(false)
  const [notes, setNotes] = useState(task.notes || '')
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('')
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleDraft, setTitleDraft] = useState(task.title)

  const {
    setNodeRef,
    attributes,
    listeners,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: task.id,
    data: { listId: task.listId },
    disabled: disableDrag,
  })

  const containerRef = useRef<HTMLDivElement | null>(null)
  const setRefs = (node: HTMLDivElement | null) => {
    setNodeRef(node)
    containerRef.current = node
  }

  useEffect(() => {
    if (!expanded) return

    const handlePointerDownOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (containerRef.current?.contains(target)) return
      // Radix portals (dropdown menu, dialog, popover, select) render outside
      // this row's DOM subtree, so interacting with them must not count as
      // "outside" or the panel would collapse mid-interaction.
      if (
        target.closest(
          '[data-slot="dialog-content"], [data-slot="dropdown-menu-content"], [data-slot="dropdown-menu-sub-content"], [data-slot="popover-content"], [data-slot="select-content"]',
        )
      ) {
        return
      }
      setExpanded(false)
    }

    document.addEventListener('mousedown', handlePointerDownOutside)
    return () =>
      document.removeEventListener('mousedown', handlePointerDownOutside)
  }, [expanded])

  const lists = useTasksStore((s) => s.lists)
  const tasks = useTasksStore((s) => s.tasks)
  const toggleTaskComplete = useTasksStore((s) => s.toggleTaskComplete)
  const toggleTaskStar = useTasksStore((s) => s.toggleTaskStar)
  const updateTask = useTasksStore((s) => s.updateTask)
  const moveTaskToList = useTasksStore((s) => s.moveTaskToList)

  const updateTaskMutation = useUpdateTaskMutation()
  const deleteTaskMutation = useDeleteTaskMutation()
  const createSubtaskMutation = useCreateSubtaskMutation()

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const handleToggleComplete = () => {
    toggleTaskComplete(task.id)
    updateTaskMutation.mutate({
      id: task.id,
      updates: {
        completed: !task.completed,
        completedAt: !task.completed ? new Date().toISOString() : undefined,
      },
    })
  }

  const handleToggleStar = () => {
    toggleTaskStar(task.id)
    updateTaskMutation.mutate({
      id: task.id,
      updates: { starred: !task.starred },
    })
  }

  const handleTitleCommit = () => {
    const trimmed = titleDraft.trim()
    setEditingTitle(false)
    if (!trimmed || trimmed === task.title) {
      setTitleDraft(task.title)
      return
    }
    updateTask(task.id, { title: trimmed })
    updateTaskMutation.mutate({ id: task.id, updates: { title: trimmed } })
  }

  const handleNotesBlur = () => {
    const trimmed = notes.trim()
    if (trimmed === (task.notes || '')) return
    const updates = { notes: trimmed || undefined }
    updateTask(task.id, updates)
    updateTaskMutation.mutate({ id: task.id, updates })
  }

  const handleDeadlineChange = (deadline: string | undefined) => {
    updateTask(task.id, { deadline })
    updateTaskMutation.mutate({ id: task.id, updates: { deadline } })
  }

  const handleDelete = () => {
    if (!confirm('Delete this task? This cannot be undone.')) return
    deleteTaskMutation.mutate(task.id)
  }

  const handleMoveToList = (listId: string) => {
    if (listId === task.listId) return
    const order = getNextOrder(tasks, listId)
    moveTaskToList(task.id, listId, order)
    updateTaskMutation.mutate({ id: task.id, updates: { listId, order } })
  }

  const handleAddSubtask = () => {
    if (!newSubtaskTitle.trim()) return
    createSubtaskMutation.mutate({
      taskId: task.id,
      title: newSubtaskTitle.trim(),
    })
    setNewSubtaskTitle('')
  }

  const colorState = task.deadline ? getDeadlineColorState(task.deadline) : null

  return (
    <div
      ref={setRefs}
      style={style}
      data-slot="task-row"
      className={cn(
        'rounded-md px-2 hover:bg-zinc-50 dark:hover:bg-zinc-900/50',
        isDragging && 'z-10 opacity-40',
      )}
    >
      <div
        className="group flex items-start gap-2 py-1"
        {...listeners}
        {...attributes}
        onClick={() => setExpanded((v) => !v)}
      >
        <Checkbox
          checked={task.completed}
          onCheckedChange={handleToggleComplete}
          onClick={(e) => e.stopPropagation()}
          className="mt-0.5 rounded-full border-zinc-400 dark:border-zinc-600"
        />
        {editingTitle ? (
          <textarea
            autoFocus
            rows={1}
            value={titleDraft}
            onChange={(e) => setTitleDraft(e.target.value)}
            onBlur={handleTitleCommit}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                e.currentTarget.blur()
              }
              if (e.key === 'Escape') {
                setTitleDraft(task.title)
                setEditingTitle(false)
              }
            }}
            className="field-sizing-content min-w-0 flex-1 resize-none border-none bg-transparent p-0 text-sm outline-none focus-visible:ring-0"
          />
        ) : (
          <span
            className={cn(
              'line-clamp-3 min-w-0 flex-1 cursor-text text-sm',
              task.completed && 'text-zinc-400 line-through dark:text-zinc-600',
            )}
            onClick={() => {
              setTitleDraft(task.title)
              setEditingTitle(true)
            }}
          >
            {task.title}
          </span>
        )}
        {list && (
          <Badge
            variant="outline"
            className="gap-1 text-[10px] whitespace-nowrap"
          >
            {list.color && (
              <span
                className="w-1.5 h-1.5 rounded-full shrink-0"
                style={{ backgroundColor: list.color }}
              />
            )}
            {list.name}
          </Badge>
        )}
        {task.deadline && (
          <span
            className={cn(
              'flex items-center gap-1 whitespace-nowrap text-xs',
              colorState && DEADLINE_COLOR_CLASSES[colorState],
            )}
          >
            {hasExplicitTime(task.deadline) && <Clock className="h-3 w-3" />}
            {formatDeadlineLabel(task.deadline)}
          </span>
        )}
        <Button
          variant="ghost"
          size="icon-xs"
          className={cn(
            'opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100 md:focus-visible:opacity-100',
            task.starred && 'opacity-100',
          )}
          onClick={(e) => {
            e.stopPropagation()
            handleToggleStar()
          }}
        >
          <Star
            className="h-4 w-4"
            fill={task.starred ? 'currentColor' : 'none'}
            color={task.starred ? '#facc15' : 'currentColor'}
          />
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon-xs"
              className="opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100 md:focus-visible:opacity-100"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>Move to list</DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                {lists.map((targetList) => (
                  <DropdownMenuItem
                    key={targetList.id}
                    disabled={targetList.id === task.listId}
                    onClick={() => handleMoveToList(targetList.id)}
                  >
                    {targetList.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuItem variant="destructive" onClick={handleDelete}>
              <Trash2 className="h-4 w-4" />
              Delete Task
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {task.subtasks.length > 0 && (
        <div className="ml-3 space-y-1 border-l border-zinc-200 pb-1 pl-4 dark:border-zinc-800">
          {task.subtasks.map((subtask) => (
            <SubtaskRow key={subtask.id} taskId={task.id} subtask={subtask} />
          ))}
        </div>
      )}

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            key="expand-panel"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="space-y-3 pb-3 pl-6">
              <Textarea
                placeholder="Add details..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                onBlur={handleNotesBlur}
                rows={2}
                className="min-h-0 resize-none border-none bg-transparent px-0 py-1 text-[11px]! shadow-none focus-visible:ring-0"
              />
              <DeadlineQuickPicks
                deadline={task.deadline}
                onChange={handleDeadlineChange}
              />

              <div className="ml-3 flex items-center gap-2 border-l border-zinc-200 pl-4 dark:border-zinc-800">
                <Input
                  placeholder="Add a subtask"
                  value={newSubtaskTitle}
                  onChange={(e) => setNewSubtaskTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAddSubtask()
                  }}
                  className="h-8 text-sm"
                />
                <Button
                  size="icon-sm"
                  variant="ghost"
                  onClick={handleAddSubtask}
                  disabled={!newSubtaskTitle.trim()}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
