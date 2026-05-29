import { AppSidebar } from '#/components/AppSidebar'
import { TopBar } from '#/components/TopBar'
import { SidebarInset, SidebarProvider } from '#/components/ui/sidebar'

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <TopBar />
        <main className="flex-1 overflow-y-auto">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  )
}
