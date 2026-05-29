import { useRouterState } from '@tanstack/react-router'
import { Plus } from 'lucide-react'

import { Button } from '#/components/ui/button'
import { SidebarTrigger, useSidebar } from '#/components/ui/sidebar'
import { useHabitsStore } from '#/stores/habits-store'

function formatTodayDate() {
  return new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })
}

export function TopBar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const setNewHabitOpen = useHabitsStore((s) => s.setNewHabitOpen)
  const isHabits = pathname === '/habits'
  const { state, isMobile, openMobile } = useSidebar()
  const showSidebarTrigger =
    isMobile ? !openMobile : state === 'collapsed'

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-border px-4 md:px-6">
      <div className="flex items-center gap-2">
        {showSidebarTrigger && <SidebarTrigger />}
        <p className="text-sm font-medium tracking-tight text-foreground md:text-base">
          {formatTodayDate()}
        </p>
      </div>

      <div className="flex items-center gap-3">
        {isHabits && (
          <Button
            size="icon"
            className="size-9 rounded-full"
            onClick={() => setNewHabitOpen(true)}
            aria-label="New habit"
          >
            <Plus className="size-4" />
          </Button>
        )}
        <span
          className="flex size-8 items-center justify-center rounded-full bg-primary/20 text-xs font-medium text-primary"
          aria-hidden
        >
          NS
        </span>
      </div>
    </header>
  )
}
