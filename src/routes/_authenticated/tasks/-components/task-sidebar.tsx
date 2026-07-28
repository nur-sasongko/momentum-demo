import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '#/components/ui/button'
import type { TaskView, TaskList } from '#/stores/tasks-store'
import { useTasksStore } from '#/stores/tasks-store'
import { NewListDialog } from './new-list-dialog'
import { AddTaskSheet } from './add-task-sheet'
import { getDefaultListId, isListView } from '../-utils/tasks-utils'

interface TaskSidebarProps {
  lists: TaskList[]
}

export function TaskSidebar({ lists }: TaskSidebarProps) {
  const [newListOpen, setNewListOpen] = useState(false)
  const [addTaskOpen, setAddTaskOpen] = useState(false)
  const selectedView = useTasksStore((s) => s.selectedView)
  const setSelectedView = useTasksStore((s) => s.setSelectedView)

  const defaultListId = getDefaultListId(selectedView, lists)

  const isAllSelected = selectedView === 'all'
  const isStarredSelected = selectedView === 'starred'
  const isListSelected = (listId: string) => isListView(selectedView, listId)

  const handleSelectView = (view: TaskView) => {
    setSelectedView(view)
  }

  return (
    <div className="w-48 border-r border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-zinc-200 dark:border-zinc-800">
        <h2 className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">
          Tasks
        </h2>
      </div>

      {/* Views */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-4 space-y-2">
          {/* Add Task */}
          <Button
            className="w-full justify-start text-sm"
            onClick={() => setAddTaskOpen(true)}
            disabled={lists.length === 0}
          >
            <Plus className="w-4 h-4 mr-1" />
            Add Task
          </Button>

          {/* All Tasks */}
          <Button
            variant={isAllSelected ? 'default' : 'ghost'}
            className="w-full justify-start text-sm"
            onClick={() => handleSelectView('all')}
          >
            All Tasks
          </Button>

          {/* Starred */}
          <Button
            variant={isStarredSelected ? 'default' : 'ghost'}
            className="w-full justify-start text-sm"
            onClick={() => handleSelectView('starred')}
          >
            ★ Starred
          </Button>

          {/* Divider */}
          <div className="my-2 h-px bg-zinc-200 dark:bg-zinc-800" />

          {/* Lists */}
          {lists.length > 0 && (
            <div className="space-y-1">
              {lists.map((list) => (
                <Button
                  key={list.id}
                  variant={isListSelected(list.id) ? 'default' : 'ghost'}
                  className="w-full justify-start text-sm"
                  onClick={() => handleSelectView({ listId: list.id })}
                  style={{
                    borderLeft: list.color
                      ? `3px solid ${list.color}`
                      : undefined,
                    paddingLeft: list.color ? '0.75rem' : undefined,
                  }}
                >
                  <span className="truncate">{list.name}</span>
                </Button>
              ))}
            </div>
          )}

          {/* New List Button */}
          <Button
            variant="ghost"
            className="w-full justify-start text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
            onClick={() => setNewListOpen(true)}
          >
            + New list
          </Button>
        </div>
      </div>

      {/* New List Dialog */}
      <NewListDialog open={newListOpen} onOpenChange={setNewListOpen} />

      {/* Add Task Dialog */}
      <AddTaskSheet
        open={addTaskOpen}
        onOpenChange={setAddTaskOpen}
        lists={lists}
        defaultListId={defaultListId}
      />
    </div>
  )
}
