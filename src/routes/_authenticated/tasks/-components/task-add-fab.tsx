import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '#/components/ui/button'
import type { TaskList } from '#/stores/tasks-store'
import { useTasksStore } from '#/stores/tasks-store'
import { getDefaultListId } from '../-utils/tasks-utils'
import { AddTaskSheet } from './add-task-sheet'

interface TaskAddFabProps {
  lists: TaskList[]
}

export function TaskAddFab({ lists }: TaskAddFabProps) {
  const [addTaskOpen, setAddTaskOpen] = useState(false)
  const selectedView = useTasksStore((s) => s.selectedView)

  const defaultListId = getDefaultListId(selectedView, lists)

  return (
    <>
      <Button
        className="fixed bottom-6 right-6 z-40 h-14 w-14 rounded-full shadow-lg p-0"
        onClick={() => setAddTaskOpen(true)}
        disabled={lists.length === 0}
        aria-label="Add task"
      >
        <Plus className="w-6 h-6" />
      </Button>

      <AddTaskSheet
        open={addTaskOpen}
        onOpenChange={setAddTaskOpen}
        lists={lists}
        defaultListId={defaultListId}
      />
    </>
  )
}
