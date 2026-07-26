import { useEffect, useState } from 'react'
import { Plus, Star } from 'lucide-react'
import { Tabs, TabsList, TabsTrigger } from '#/components/ui/tabs'
import type { TaskList } from '#/stores/tasks-store'
import { useTasksStore } from '#/stores/tasks-store'
import { getViewKey } from '../-utils/tasks-utils'
import { NewListDialog } from './new-list-dialog'

const NEW_LIST_VALUE = '__new_list__'

interface TaskMobileTabsProps {
  lists: TaskList[]
}

export function TaskMobileTabs({ lists }: TaskMobileTabsProps) {
  const [newListOpen, setNewListOpen] = useState(false)
  const selectedView = useTasksStore((s) => s.selectedView)
  const setSelectedView = useTasksStore((s) => s.setSelectedView)

  // Mobile tabs have no "All" entry, so redirect away from it once so a tab
  // is always actually active (e.g. first visit, or arriving from desktop
  // where "All Tasks" was selected).
  useEffect(() => {
    if (selectedView !== 'all') return
    setSelectedView(lists.length > 0 ? { listId: lists[0].id } : 'starred')
  }, [selectedView, lists, setSelectedView])

  const handleValueChange = (value: string) => {
    if (value === NEW_LIST_VALUE) {
      setNewListOpen(true)
      return
    }
    if (value === 'starred') {
      setSelectedView('starred')
      return
    }
    setSelectedView({ listId: value.replace('list-', '') })
  }

  return (
    <div className="border-b border-zinc-200 dark:border-zinc-800 overflow-x-auto">
      <Tabs value={getViewKey(selectedView)} onValueChange={handleValueChange}>
        <TabsList variant="line" className="w-full flex-nowrap px-2">
          <TabsTrigger value="starred" className="flex-none">
            <Star
              className="w-4 h-4"
              fill={selectedView === 'starred' ? 'currentColor' : 'none'}
            />
          </TabsTrigger>
          {lists.map((list) => (
            <TabsTrigger
              key={list.id}
              value={`list-${list.id}`}
              className="flex-none gap-1.5"
            >
              {list.color && (
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: list.color }}
                />
              )}
              <span className="truncate max-w-24">{list.name}</span>
            </TabsTrigger>
          ))}
          <TabsTrigger value={NEW_LIST_VALUE} className="flex-none">
            <Plus className="w-4 h-4" />
            New list
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <NewListDialog open={newListOpen} onOpenChange={setNewListOpen} />
    </div>
  )
}
