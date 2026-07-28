import { useState } from 'react'
import { ChevronDown, PartyPopper, Plus } from 'lucide-react'
import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { Button } from '#/components/ui/button'
import type { Task, TaskList } from '#/stores/tasks-store'
import {
  getIncompleteTasks,
  getCompletedTasks,
  getCompletedCount,
} from '../-utils/tasks-utils'
import { TaskRow } from './task-row'
import { AddTaskSheet } from './add-task-sheet'

interface TaskColumnProps {
  list: TaskList
  lists: TaskList[]
  tasks: Task[]
  activeId: string | null
}

export function TaskColumn({ list, lists, tasks, activeId }: TaskColumnProps) {
  const [showCompleted, setShowCompleted] = useState(false)
  const [addTaskOpen, setAddTaskOpen] = useState(false)
  const { setNodeRef } = useDroppable({
    id: `list-${list.id}`,
  })

  const incompleteTasks = getIncompleteTasks(tasks)
  const completedTasks = getCompletedTasks(tasks)
  const completedCount = getCompletedCount(tasks)

  return (
    <div
      ref={setNodeRef}
      className="flex flex-col w-full md:w-80 bg-white dark:bg-zinc-900 rounded-lg border-2 border-zinc-200 dark:border-zinc-800 overflow-hidden"
    >
      {/* Header */}
      <div
        className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between"
        style={{
          borderLeft: list.color ? `4px solid ${list.color}` : undefined,
          paddingLeft: list.color ? '0.75rem' : undefined,
        }}
      >
        <div>
          <h3 className="text-sm text-zinc-900 dark:text-zinc-100">
            {list.name}
          </h3>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-2 py-3 flex flex-col">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-sm mb-2"
          onClick={() => setAddTaskOpen(true)}
        >
          <Plus className="w-4 h-4 mr-1" />
          Add a Task
        </Button>

        <div className="flex-1">
          {incompleteTasks.length === 0 && completedCount === 0 ? (
            <div className="text-center py-8">
              <PartyPopper className="w-8 h-8 mx-auto mb-2 text-zinc-400 dark:text-zinc-500" />
              <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                All tasks complete
              </p>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Fantastic Job!
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {/* Incomplete Tasks */}
              <SortableContext
                items={incompleteTasks.map((t) => t.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-0.5">
                  {incompleteTasks.map((task) => (
                    <div key={task.id}>
                      {task.id === activeId && (
                        <div className="h-0.5 rounded-full bg-blue-500 mb-1" />
                      )}
                      <TaskRow task={task} />
                    </div>
                  ))}
                  {incompleteTasks.length === 0 && (
                    <div className="text-center py-4 text-xs text-zinc-400 border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded">
                      Drop tasks here
                    </div>
                  )}
                </div>
              </SortableContext>

              {/* Completed Tasks Section */}
              {completedCount > 0 && (
                <div className="mt-4 pt-4 border-t border-zinc-200 dark:border-zinc-800">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-center text-xs text-zinc-600 dark:text-zinc-400"
                    onClick={() => setShowCompleted(!showCompleted)}
                  >
                    <ChevronDown
                      className="w-4 h-4 mr-1"
                      style={{
                        transform: showCompleted
                          ? 'rotate(0)'
                          : 'rotate(-90deg)',
                        transition: 'transform 0.2s',
                      }}
                    />
                    {completedCount} completed
                  </Button>

                  {showCompleted && (
                    <div className="space-y-2 mt-3">
                      {completedTasks.map((task) => (
                        <TaskRow key={task.id} task={task} />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Add Task Dialog */}
      <AddTaskSheet
        open={addTaskOpen}
        onOpenChange={setAddTaskOpen}
        lists={lists}
        defaultListId={list.id}
      />
    </div>
  )
}
