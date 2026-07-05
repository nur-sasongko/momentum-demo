import {
  DndContext,
  DragOverlay,
  closestCorners,
  defaultDropAnimationSideEffects,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import type {
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
  DropAnimation,
} from '@dnd-kit/core'
import { Calendar } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { useEffect, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { Badge } from '#/components/ui/badge'
import type { Task, TaskList, TaskView } from '#/stores/tasks-store'
import { useTasksStore } from '#/stores/tasks-store'
import {
  filterByView,
  formatSubtaskCount,
  getListsForView,
} from '../-utils/tasks-utils'
import { TaskColumn } from './task-column'
import { useUpdateTaskMutation } from '../-utils/tasks-queries'

const dropAnimation: DropAnimation = {
  duration: 200,
  easing: 'cubic-bezier(0.2, 0, 0, 1)',
  sideEffects: defaultDropAnimationSideEffects({
    styles: { active: { opacity: '0.4' } },
  }),
}

interface TaskBoardProps {
  tasks: Task[]
  lists: TaskList[]
  selectedView: TaskView
}

export function TaskBoard({ tasks, lists, selectedView }: TaskBoardProps) {
  const [activeId, setActiveId] = useState<string | null>(null)
  const [draftTasks, setDraftTasks] = useState<Task[] | null>(null)
  const moveTaskToList = useTasksStore((s) => s.moveTaskToList)
  const reorderTask = useTasksStore((s) => s.reorderTask)
  const updateTaskMutation = useUpdateTaskMutation()

  const scrollRef = useRef<HTMLDivElement | null>(null)
  const panOrigin = useRef<{ x: number; scrollLeft: number } | null>(null)
  const [isPanning, setIsPanning] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 4 },
    }),
  )

  // Click-and-drag panning of the board: only starts when the pointer goes
  // down on empty board space (not a task row, button, or other interactive
  // element), so it never competes with dnd-kit's row dragging. Touch
  // pointers get native scrolling instead, so this is mouse-only.
  const handlePanPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || event.pointerType !== 'mouse') return
    const target = event.target as HTMLElement
    if (
      target.closest(
        '[data-slot="task-row"], button, a, input, textarea, select, [role="button"]',
      )
    ) {
      return
    }
    const container = scrollRef.current
    if (!container) return
    panOrigin.current = { x: event.clientX, scrollLeft: container.scrollLeft }
    setIsPanning(true)
  }

  useEffect(() => {
    if (!isPanning) return
    const container = scrollRef.current
    if (!container) return

    const handlePointerMove = (event: PointerEvent) => {
      if (!panOrigin.current) return
      container.scrollLeft =
        panOrigin.current.scrollLeft - (event.clientX - panOrigin.current.x)
    }
    const stopPanning = () => {
      panOrigin.current = null
      setIsPanning(false)
    }

    document.body.style.userSelect = 'none'
    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', stopPanning)
    window.addEventListener('pointercancel', stopPanning)
    return () => {
      document.body.style.userSelect = ''
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', stopPanning)
      window.removeEventListener('pointercancel', stopPanning)
    }
  }, [isPanning])

  const visibleLists = getListsForView(lists, selectedView)
  const displayTasks = draftTasks ?? tasks
  const visibleTasks = filterByView(displayTasks, selectedView)

  const activeDraggedTask = activeId
    ? displayTasks.find((t) => t.id === activeId)
    : null

  // Resolve which list a given droppable/sortable id belongs to.
  // A sortable task id is a bare task id; a column id is prefixed with "list-".
  const resolveListId = (id: string, source: Task[]): string | null => {
    if (id.startsWith('list-')) return id.replace('list-', '')
    const t = source.find((task) => task.id === id)
    return t ? t.listId : null
  }

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(String(event.active.id))
    setDraftTasks(tasks)
  }

  // Live reorder preview: move the active task within `draftTasks` (local UI
  // state only, never persisted) as the pointer moves over other rows or
  // columns. Because every TaskRow keeps the same `key`/sortable id no
  // matter which column it's logically in, React reuses the same DOM node
  // when it "moves" between columns instead of unmounting/remounting it, so
  // this stays smooth across columns too.
  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event
    if (!over) return

    setDraftTasks((current) => {
      if (!current) return current

      const activeTaskId = String(active.id)
      const overId = String(over.id)
      if (activeTaskId === overId) return current

      const activeTask = current.find((t) => t.id === activeTaskId)
      if (!activeTask) return current

      const targetListId = resolveListId(overId, current)
      if (!targetListId) return current

      const destTasks = current
        .filter(
          (t) =>
            t.listId === targetListId && !t.completed && t.id !== activeTaskId,
        )
        .sort((a, b) => a.order - b.order)

      let insertIndex = destTasks.length
      if (!overId.startsWith('list-')) {
        const overIndex =
          (over.data.current?.sortable?.index as number | undefined) ??
          destTasks.findIndex((t) => t.id === overId)
        if (overIndex !== -1) insertIndex = overIndex
      }

      const alreadyInPlace =
        activeTask.listId === targetListId &&
        destTasks.findIndex((t) => t.id === overId) === insertIndex - 1
      if (alreadyInPlace) return current

      const reordered = [...destTasks]
      reordered.splice(insertIndex, 0, { ...activeTask, listId: targetListId })
      // Renumber `order` to match the new array position so downstream
      // sort-by-order rendering (getIncompleteTasks) reflects the live preview.
      const renumbered = reordered.map((t, index) => ({ ...t, order: index }))

      const otherTasks = current.filter(
        (t) =>
          t.id !== activeTaskId && !(t.listId === targetListId && !t.completed),
      )
      return [...otherTasks, ...renumbered]
    })
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    const activeTaskId = String(active.id)
    const finalTasks = draftTasks

    setActiveId(null)
    setDraftTasks(null)

    if (!over || !finalTasks) return

    const activeTask = finalTasks.find((t) => t.id === activeTaskId)
    if (!activeTask) return

    const originalTask = tasks.find((t) => t.id === activeTaskId)
    if (!originalTask) return

    // Persist every task in the destination column whose order/listId
    // changed, based on the final draft arrangement.
    const finalOrder = finalTasks
      .filter((t) => t.listId === activeTask.listId && !t.completed)
      .sort((a, b) => a.order - b.order)

    finalOrder.forEach((t, index) => {
      const original = tasks.find((task) => task.id === t.id)
      if (!original) return

      const isActiveTask = t.id === activeTaskId
      const listChanged = isActiveTask && original.listId !== activeTask.listId
      const orderChanged = original.order !== index

      if (!listChanged && !orderChanged) return

      reorderTask(t.id, index)
      if (isActiveTask) {
        moveTaskToList(t.id, activeTask.listId, index)
      }

      updateTaskMutation.mutate({
        id: t.id,
        updates: isActiveTask
          ? { listId: activeTask.listId, order: index }
          : { order: index },
      })
    })
  }

  if (visibleLists.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <p className="text-zinc-500 dark:text-zinc-400">No lists found</p>
          <p className="text-sm text-zinc-400 dark:text-zinc-600">
            Create your first list to get started
          </p>
        </div>
      </div>
    )
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={() => {
        setActiveId(null)
        setDraftTasks(null)
      }}
    >
      <div
        ref={scrollRef}
        onPointerDown={handlePanPointerDown}
        className={`flex-1 overflow-auto ${isPanning ? 'cursor-grabbing' : 'cursor-grab'}`}
      >
        <div className="flex items-start gap-4 p-4 min-w-min">
          {visibleLists.map((list) => {
            const listTasks = visibleTasks.filter((t) => t.listId === list.id)
            return (
              <TaskColumn
                key={list.id}
                list={list}
                lists={lists}
                tasks={listTasks}
                activeId={activeId}
              />
            )
          })}
        </div>
      </div>

      <DragOverlay dropAnimation={dropAnimation}>
        {activeDraggedTask ? (
          <div className="bg-white dark:bg-zinc-800 p-3 rounded-lg shadow-xl border border-zinc-200 dark:border-zinc-700 w-72 rotate-1 cursor-grabbing">
            <p className="text-sm font-medium wrap-break-word">
              {activeDraggedTask.title}
            </p>
            {(activeDraggedTask.deadline ||
              activeDraggedTask.subtasks.length > 0) && (
              <div className="flex flex-wrap gap-2 mt-2">
                {activeDraggedTask.deadline && (
                  <Badge variant="secondary" className="text-xs">
                    <Calendar className="w-3 h-3 mr-1" />
                    {formatDistanceToNow(new Date(activeDraggedTask.deadline), {
                      addSuffix: true,
                    })}
                  </Badge>
                )}
                {activeDraggedTask.subtasks.length > 0 && (
                  <Badge variant="outline" className="text-xs">
                    {formatSubtaskCount(activeDraggedTask)}
                  </Badge>
                )}
              </div>
            )}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}
