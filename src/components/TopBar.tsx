import { useQueryClient } from '@tanstack/react-query'
import {
  useNavigate,
  useRouteContext,
  useRouterState,
} from '@tanstack/react-router'
import { Check, LogOut, Monitor, Moon, Plus, Sun } from 'lucide-react'

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
import { signOut } from '#/libs/auth/auth-adapter'
import { useTheme } from '#/hooks/use-theme'
import { useHabitsStore } from '#/stores/habits-store'

import type { Theme } from '#/hooks/use-theme'
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
  const { isMobile, openMobile } = useSidebar()
  const { theme, setTheme } = useTheme()
  const user = useRouteContext({ from: '__root__', select: (c) => c.user })
  const initials = user?.email?.slice(0, 2).toUpperCase() ?? '?'
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  async function handleLogout() {
    await signOut()
    queryClient.clear()
    await navigate({ to: '/login' })
  }

  return (
    <header className="flex h-(--topbar-height) shrink-0 items-center justify-between border-b border-border px-4 md:px-6">
      <div className="flex items-center gap-2">
        {isMobile && !openMobile && <SidebarTrigger />}
        <p className="text-sm font-medium tracking-tight text-foreground md:text-base">
          {formatTodayDate()}
        </p>
      </div>

      <div className="flex items-center gap-1">
        {isHabits && (
          <Button
            size="icon"
            className="size-8 rounded-full"
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
              className="size-7 rounded-full p-0"
              aria-label="Profile menu"
            >
              <span className="flex size-7 items-center justify-center rounded-full bg-primary/20 text-xs font-medium text-primary">
                {initials}
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
            <DropdownMenuItem onClick={handleLogout}>
              <LogOut />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
