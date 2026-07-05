import { useState } from 'react'
import { Menu, Plus } from 'lucide-react'
import { Button } from '#/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '#/components/ui/sheet'
import type { TaskView, TaskList } from '#/stores/tasks-store'
import { useTasksStore } from '#/stores/tasks-store'
import { NewListDialog } from './new-list-dialog'
import { AddTaskDialog } from './add-task-dialog'

interface TaskSidebarProps {
  lists: TaskList[]
}

function TaskSidebarNav({
  lists,
  onNavigate,
  onAddTask,
  onNewList,
}: {
  lists: TaskList[]
  onNavigate?: () => void
  onAddTask: () => void
  onNewList: () => void
}) {
  const selectedView = useTasksStore((s) => s.selectedView)
  const setSelectedView = useTasksStore((s) => s.setSelectedView)

  const isAllSelected = selectedView === 'all'
  const isStarredSelected = selectedView === 'starred'
  const isListSelected = (listId: string) =>
    typeof selectedView === 'object' &&
    'listId' in selectedView &&
    !('starred' in selectedView) &&
    selectedView.listId === listId

  const handleSelectView = (view: TaskView) => {
    setSelectedView(view)
    onNavigate?.()
  }

  return (
    <div className="p-4 space-y-2">
      {/* Add Task */}
      <Button
        className="w-full justify-start text-sm"
        onClick={onAddTask}
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
                borderLeft: list.color ? `3px solid ${list.color}` : undefined,
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
        onClick={onNewList}
      >
        + New list
      </Button>
    </div>
  )
}

export function TaskSidebar({ lists }: TaskSidebarProps) {
  const [newListOpen, setNewListOpen] = useState(false)
  const [addTaskOpen, setAddTaskOpen] = useState(false)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const selectedView = useTasksStore((s) => s.selectedView)

  const defaultListId =
    typeof selectedView === 'object' && 'listId' in selectedView
      ? selectedView.listId
      : lists[0]?.id

  const selectedViewLabel =
    selectedView === 'all'
      ? 'All Tasks'
      : selectedView === 'starred'
        ? '★ Starred'
        : (lists.find((l) => l.id === selectedView.listId)?.name ?? 'Tasks')

  return (
    <>
      {/* Mobile top bar */}
      <div className="flex items-center gap-2 border-b border-zinc-200 p-3 dark:border-zinc-800 md:hidden">
        <Button
          variant="outline"
          size="icon"
          onClick={() => setMobileNavOpen(true)}
          aria-label="Open task lists"
        >
          <Menu className="h-4 w-4" />
        </Button>
        <h2 className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          {selectedViewLabel}
        </h2>
      </div>

      {/* Desktop sidebar */}
      <div className="hidden w-48 shrink-0 flex-col overflow-hidden border-r border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 md:flex">
        <div className="p-4 border-b border-zinc-200 dark:border-zinc-800">
          <h2 className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">
            Tasks
          </h2>
        </div>
        <div className="flex-1 overflow-y-auto">
          <TaskSidebarNav
            lists={lists}
            onAddTask={() => setAddTaskOpen(true)}
            onNewList={() => setNewListOpen(true)}
          />
        </div>
      </div>

      {/* Mobile nav sheet */}
      <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <SheetContent side="left" className="w-72 p-0">
          <SheetHeader className="border-b border-zinc-200 dark:border-zinc-800">
            <SheetTitle>Tasks</SheetTitle>
            <SheetDescription className="sr-only">
              Browse and switch between your task views and lists
            </SheetDescription>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto">
            <TaskSidebarNav
              lists={lists}
              onNavigate={() => setMobileNavOpen(false)}
              onAddTask={() => {
                setMobileNavOpen(false)
                setAddTaskOpen(true)
              }}
              onNewList={() => {
                setMobileNavOpen(false)
                setNewListOpen(true)
              }}
            />
          </div>
        </SheetContent>
      </Sheet>

      {/* New List Dialog */}
      <NewListDialog open={newListOpen} onOpenChange={setNewListOpen} />

      {/* Add Task Dialog */}
      <AddTaskDialog
        open={addTaskOpen}
        onOpenChange={setAddTaskOpen}
        lists={lists}
        defaultListId={defaultListId}
      />
    </>
  )
}
