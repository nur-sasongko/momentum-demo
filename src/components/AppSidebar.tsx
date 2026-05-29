import { Link, useRouterState } from '@tanstack/react-router'
import { Brain, Flame, Wallet } from 'lucide-react'

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarTrigger,
} from '#/components/ui/sidebar'

type EnabledNavItem = {
  to: '/notes' | '/habits' | '/finance'
  label: string
  icon: typeof Brain
  enabled: true
}

type DisabledNavItem = {
  to: string
  label: string
  icon: typeof Brain
  enabled: false
}

type NavItem = EnabledNavItem | DisabledNavItem

const navItems: NavItem[] = [
  { to: '/notes' as const, label: 'Second Brain', icon: Brain, enabled: true },
  { to: '/finance' as const, label: 'Finance', icon: Wallet, enabled: true },
  { to: '/habits' as const, label: 'Habits', icon: Flame, enabled: true },
]

export function AppSidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem className="flex items-center gap-1">
            <SidebarMenuButton size="lg" tooltip="MySpace" className="min-w-0 flex-1">
              <span className="flex size-8 items-center justify-center rounded-lg bg-primary/20 text-xs font-semibold text-primary">
                MS
              </span>
              <span className="font-semibold tracking-tight group-data-[collapsible=icon]:hidden">
                MySpace
              </span>
            </SidebarMenuButton>
            <SidebarTrigger className="shrink-0 group-data-[collapsible=icon]:hidden" />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => {
                const Icon = item.icon

                if (!item.enabled) {
                  return (
                    <SidebarMenuItem key={item.to}>
                      <SidebarMenuButton disabled tooltip="Coming soon">
                        <Icon />
                        <span>{item.label}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )
                }

                return (
                  <SidebarMenuItem key={item.to}>
                    <SidebarMenuButton
                      asChild
                      isActive={
                        pathname === item.to ||
                        pathname.startsWith(`${item.to}/`)
                      }
                      tooltip={item.label}
                    >
                      <Link to={item.to}>
                        <Icon />
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  )
}
