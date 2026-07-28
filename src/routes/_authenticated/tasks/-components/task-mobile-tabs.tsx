import { useEffect, useState } from 'react'
import { Plus, Star } from 'lucide-react'
import { Tabs, TabsList, TabsTrigger } from '#/components/ui/tabs'
import type { TaskList } from '#/stores/tasks-store'
import { useTasksStore } from '#/stores/tasks-store'
import { getViewKey } from '../-utils/tasks-utils'
import { NewListSheet } from './new-list-sheet'

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
    <div className="shrink-0 border-b border-zinc-200 dark:border-zinc-800">
      <div className="overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <Tabs
          value={getViewKey(selectedView)}
          onValueChange={handleValueChange}
          className="w-max min-w-full"
        >
          <TabsList
            variant="line"
            className="h-auto w-max min-w-full flex-nowrap justify-start gap-1 px-3"
          >
            <TabsTrigger value="starred" className="flex-none shrink-0">
              <Star
                className="size-4"
                fill={selectedView === 'starred' ? 'currentColor' : 'none'}
              />
              <span className="sr-only">Starred</span>
            </TabsTrigger>
            {lists.map((list) => (
              <TabsTrigger
                key={list.id}
                value={`list-${list.id}`}
                className="flex-none shrink-0 gap-1.5"
              >
                {list.color && (
                  <span
                    className="size-2 shrink-0 rounded-full"
                    style={{ backgroundColor: list.color }}
                  />
                )}
                <span className="max-w-24 truncate">{list.name}</span>
              </TabsTrigger>
            ))}
            <TabsTrigger value={NEW_LIST_VALUE} className="flex-none shrink-0">
              <Plus className="size-4" />
              <span className="sr-only">New list</span>
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <NewListSheet open={newListOpen} onOpenChange={setNewListOpen} />
    </div>
  )
}
