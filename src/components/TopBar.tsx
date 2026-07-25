import { useQueryClient } from '@tanstack/react-query'
import {
  Link,
  useNavigate,
  useRouteContext,
  useRouterState,
} from '@tanstack/react-router'
import { Check, LogOut, Monitor, Moon, Sun } from 'lucide-react'

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
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
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center justify-between border-b border-border bg-background px-4 sm:h-(--topbar-height) md:px-3">
      <div className="flex items-center gap-2">
        {isMobile && !openMobile && (
          <SidebarTrigger className="size-9 sm:size-7" />
        )}
        <img src="/icon.svg" alt="" className="size-7 rounded-md sm:size-6" />
        <Breadcrumb>
          <BreadcrumbList className="flex-nowrap">
            <BreadcrumbItem>
              {pageLabel ? (
                <BreadcrumbLink
                  asChild
                  className="text-sm font-medium tracking-tight md:text-base"
                >
                  <Link to="/">Momentum</Link>
                </BreadcrumbLink>
              ) : (
                <BreadcrumbPage className="text-sm font-medium tracking-tight md:text-base">
                  Momentum
                </BreadcrumbPage>
              )}
            </BreadcrumbItem>
            {pageLabel && (
              <>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbPage className="text-sm font-medium tracking-tight md:text-base">
                    {pageLabel}
                  </BreadcrumbPage>
                </BreadcrumbItem>
              </>
            )}
          </BreadcrumbList>
        </Breadcrumb>
      </div>

      <div className="flex items-center gap-1">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-9 rounded-full p-0 sm:size-7"
              aria-label="Profile menu"
            >
              <span className="flex size-9 items-center justify-center rounded-full bg-primary/20 text-sm font-medium text-primary sm:size-7 sm:text-xs">
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
