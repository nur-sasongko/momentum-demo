import { Link, useRouterState } from '@tanstack/react-router'
import { Brain, Flame, Wallet } from 'lucide-react'

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
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
  const { isMobile, setOpenMobile } = useSidebar()

  return (
    <Sidebar className="border-r">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => {
                const Icon = item.icon

                if (!item.enabled) {
                  return (
                    <SidebarMenuItem key={item.to}>
                      <SidebarMenuButton disabled>
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
                    >
                      <Link
                        to={item.to}
                        onClick={(event) => {
                          if (isMobile) {
                            setOpenMobile(false)
                          } else {
                            event.currentTarget.blur()
                          }
                        }}
                      >
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
    </Sidebar>
  )
}
