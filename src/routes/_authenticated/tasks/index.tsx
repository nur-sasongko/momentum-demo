import { createFileRoute } from '@tanstack/react-router'
import { useEffect, Suspense } from 'react'
import { useTasksQuery } from './-utils/tasks-queries'
import { useTasksStore } from '#/stores/tasks-store'
import {
  checkAndFireNotifications,
  requestNotificationPermission,
} from './-utils/notification-service'
import { Skeleton } from '#/components/ui/skeleton'
import { useIsMobile } from '#/hooks/use-mobile'
import { cn } from '#/libs/utils'
import { TaskSidebar } from './-components/task-sidebar'
import { TaskMobileTabs } from './-components/task-mobile-tabs'
import { TaskAddFab } from './-components/task-add-fab'
import { TaskBoard } from './-components/task-board'

function TasksPageContent() {
  const tasksQuery = useTasksQuery()
  const tasks = useTasksStore((s) => s.tasks)
  const lists = useTasksStore((s) => s.lists)
  const selectedView = useTasksStore((s) => s.selectedView)
  const notificationSettings = useTasksStore((s) => s.notificationSettings)
  const isMobile = useIsMobile()

  // Request notification permission on mount
  useEffect(() => {
    requestNotificationPermission()
  }, [])

  // Check and fire notifications periodically
  useEffect(() => {
    if (tasks.length > 0 && lists.length > 0) {
      checkAndFireNotifications(
        tasks,
        lists,
        notificationSettings.enabled,
        notificationSettings.quietHoursStart,
        notificationSettings.quietHoursEnd,
      )
    }

    // Check every 5 minutes
    const interval = setInterval(
      () => {
        checkAndFireNotifications(
          tasks,
          lists,
          notificationSettings.enabled,
          notificationSettings.quietHoursStart,
          notificationSettings.quietHoursEnd,
        )
      },
      5 * 60 * 1000,
    )

    return () => clearInterval(interval)
  }, [tasks, lists, notificationSettings])

  if (tasksQuery.isLoading) {
    return (
      <div className="flex h-[calc(100dvh-3.5rem)] flex-col overflow-hidden md:flex-row">
        <div className="hidden w-48 shrink-0 border-r border-zinc-200 p-4 dark:border-zinc-800 md:block">
          <Skeleton className="h-8 w-32 mb-4" />
          <Skeleton className="h-8 w-32 mb-2" />
          <Skeleton className="h-8 w-32 mb-2" />
        </div>
        <div className="flex-1 p-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div key={i}>
                <Skeleton className="h-8 w-24 mb-4" />
                <Skeleton className="h-32 w-full mb-2" />
                <Skeleton className="h-32 w-full" />
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (tasksQuery.error) {
    return (
      <div className="flex h-[calc(100dvh-3.5rem)] items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 dark:text-red-400">Error loading tasks</p>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            {tasksQuery.error instanceof Error
              ? tasksQuery.error.message
              : 'Unknown error'}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div
      className={cn(
        'h-[calc(100dvh-3.5rem)] overflow-hidden',
        isMobile ? 'flex flex-col' : 'flex',
      )}
    >
      {isMobile ? (
        <TaskMobileTabs lists={lists} />
      ) : (
        <TaskSidebar lists={lists} />
      )}
      <TaskBoard tasks={tasks} lists={lists} selectedView={selectedView} />
      {isMobile && <TaskAddFab lists={lists} />}
    </div>
  )
}

export const Route = createFileRoute('/_authenticated/tasks/')({
  component: () => (
    <Suspense
      fallback={
        <div className="flex h-[calc(100dvh-3.5rem)] flex-col overflow-hidden md:flex-row">
          <div className="hidden w-48 shrink-0 border-r border-zinc-200 p-4 dark:border-zinc-800 md:block">
            <Skeleton className="h-8 w-32 mb-4" />
          </div>
          <div className="flex-1 p-4">
            <Skeleton className="h-8 w-24 mb-4" />
          </div>
        </div>
      }
    >
      <TasksPageContent />
    </Suspense>
  ),
})
