import { useQueryClient } from '@tanstack/react-query'
import {
  useNavigate,
  useRouteContext,
  useRouterState,
} from '@tanstack/react-router'
import { Check, LogOut, Monitor, Moon, Sun } from 'lucide-react'

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from '#/components/ui/breadcrumb'
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

import type { Theme } from '#/hooks/use-theme'

const themeOptions: { value: Theme; label: string; icon: typeof Sun }[] = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'auto', label: 'System', icon: Monitor },
]

const pageLabels: Record<string, string> = {
  '/notes': 'Second Brain',
  '/finance': 'Finance',
  '/habits': 'Habits',
}

function getPageLabel(pathname: string) {
  const path = Object.keys(pageLabels).find(
    (candidate) =>
      pathname === candidate || pathname.startsWith(`${candidate}/`),
  )
  return path ? pageLabels[path] : null
}

export function TopBar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const { isMobile, openMobile } = useSidebar()
  const { theme, setTheme } = useTheme()
  const user = useRouteContext({ from: '__root__', select: (c) => c.user })
  const initials = user?.email?.slice(0, 2).toUpperCase() ?? '?'
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const pageLabel = getPageLabel(pathname)

  async function handleLogout() {
    await signOut()
    queryClient.clear()
    await navigate({ to: '/login' })
  }

  return (
    <header className="sticky top-0 z-30 flex h-(--topbar-height) shrink-0 items-center justify-between border-b border-border bg-background px-4 md:px-6">
      <div className="flex items-center gap-2">
        {isMobile && !openMobile && <SidebarTrigger />}
        <img src="/icon.svg" alt="" className="size-6 rounded-md" />
        {pageLabel && (
          <Breadcrumb>
            <BreadcrumbList className="flex-nowrap">
              <BreadcrumbItem>
                <BreadcrumbPage className="text-sm font-medium tracking-tight md:text-base">
                  {pageLabel}
                </BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        )}
      </div>

      <div className="flex items-center gap-1">
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
