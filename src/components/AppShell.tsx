import { AppSidebar } from '#/components/AppSidebar'
import { TopBar } from '#/components/TopBar'
import { SidebarInset, SidebarProvider } from '#/components/ui/sidebar'

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider className="h-svh flex-col overflow-hidden">
      <TopBar />
      <div className="flex min-h-0 min-w-0 flex-1">
        <AppSidebar />
        <SidebarInset>
          <div className="min-h-0 min-w-0 flex-1 overflow-auto">{children}</div>
        </SidebarInset>
      </div>
    </SidebarProvider>
  )
}
