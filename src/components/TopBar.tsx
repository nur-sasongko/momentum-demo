import { useRouterState } from '@tanstack/react-router'
import { Check, Monitor, Moon, Plus, Sun, User } from 'lucide-react'

import { useTheme } from '#/components/ThemeToggle'
import { Button } from '#/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '#/components/ui/dropdown-menu'
import { SidebarTrigger, useSidebar } from '#/components/ui/sidebar'
import { useHabitsStore } from '#/stores/habits-store'

import type { Theme } from '#/components/ThemeToggle'
import { formatTodayDate } from '#/utils/date'

const themeOptions: { value: Theme; label: string; icon: typeof Sun }[] = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'auto', label: 'System', icon: Monitor },
]

export function TopBar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const setNewHabitOpen = useHabitsStore((s) => s.setNewHabitOpen)
  const isHabits = pathname === '/habits'
  const { state, isMobile, openMobile } = useSidebar()
  const showSidebarTrigger =
    isMobile ? !openMobile : state === 'collapsed'
  const { theme, setTheme } = useTheme()

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-border px-4 md:px-6">
      <div className="flex items-center gap-2">
        {showSidebarTrigger && <SidebarTrigger />}
        <p className="text-sm font-medium tracking-tight text-foreground md:text-base">
          {formatTodayDate()}
        </p>
      </div>

      <div className="flex items-center gap-1">
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
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-8 rounded-full p-0"
              aria-label="Profile menu"
            >
              <span className="flex size-8 items-center justify-center rounded-full bg-primary/20 text-xs font-medium text-primary">
                NS
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuLabel>Theme</DropdownMenuLabel>
            {themeOptions.map((option) => {
              const Icon = option.icon
              return (
                <DropdownMenuItem
                  key={option.value}
                  onClick={() => setTheme(option.value)}
                >
                  <Icon />
                  <span className="flex-1">{option.label}</span>
                  {theme === option.value && (
                    <Check className="size-4 text-primary" />
                  )}
                </DropdownMenuItem>
              )
            })}
            <DropdownMenuSeparator />
            <DropdownMenuItem disabled>
              <User />
              Profile
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
