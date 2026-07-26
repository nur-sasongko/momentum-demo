import { useState } from 'react'
import { ChevronDown, Star } from 'lucide-react'
import { Button } from '#/components/ui/button'
import type { Task, TaskList } from '#/stores/tasks-store'
import {
  getCompletedCount,
  getCompletedTasks,
  getIncompleteTasks,
} from '../-utils/tasks-utils'
import { TaskRow } from './task-row'

interface StarredCardProps {
  tasks: Task[]
  lists: TaskList[]
}

export function StarredCard({ tasks, lists }: StarredCardProps) {
  const [showCompleted, setShowCompleted] = useState(false)

  const incompleteTasks = getIncompleteTasks(tasks)
  const completedTasks = getCompletedTasks(tasks)
  const completedCount = getCompletedCount(tasks)

  const listById = new Map(lists.map((list) => [list.id, list]))

  return (
    <div className="flex flex-col w-full max-w-xl mx-auto bg-white dark:bg-zinc-900 rounded-lg border-2 border-zinc-200 dark:border-zinc-800 overflow-hidden">
      <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center gap-2">
        <Star className="w-4 h-4" fill="currentColor" />
        <h3 className="text-sm text-zinc-900 dark:text-zinc-100">Starred</h3>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-3 flex flex-col">
        {incompleteTasks.length === 0 && completedCount === 0 ? (
          <div className="text-center py-8">
            <Star className="w-8 h-8 mx-auto mb-2 text-zinc-400 dark:text-zinc-500" />
            <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              No starred tasks yet
            </p>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Tap the star on a task to pin it here
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="space-y-0.5">
              {incompleteTasks.map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  disableDrag
                  list={listById.get(task.listId)}
                />
              ))}
            </div>

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
                      transform: showCompleted ? 'rotate(0)' : 'rotate(-90deg)',
                      transition: 'transform 0.2s',
                    }}
                  />
                  {completedCount} completed
                </Button>

                {showCompleted && (
                  <div className="space-y-2 mt-3">
                    {completedTasks.map((task) => (
                      <TaskRow
                        key={task.id}
                        task={task}
                        disableDrag
                        list={listById.get(task.listId)}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
