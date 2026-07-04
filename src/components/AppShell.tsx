import { AppSidebar } from '#/components/AppSidebar'
import { TopBar } from '#/components/TopBar'
import { SidebarInset, SidebarProvider } from '#/components/ui/sidebar'

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider className="flex-col">
      <TopBar />
      <div className="flex min-h-0 flex-1">
        <AppSidebar />
        <SidebarInset>
          <main className="flex-1 overflow-y-auto">{children}</main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  )
}
