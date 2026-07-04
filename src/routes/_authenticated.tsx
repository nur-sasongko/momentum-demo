import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'

import { AppShell } from '#/components/AppShell'

export const Route = createFileRoute('/_authenticated')({
  beforeLoad: ({ context, location }) => {
    if (!context.user) {
      throw redirect({
        to: '/login',
        search: { redirect: location.href },
      })
    }
  },
  pendingComponent: () => (
    <div className="flex min-h-screen items-center justify-center">
      <div className="size-6 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-foreground" />
    </div>
  ),
  pendingMs: 0,
  pendingMinMs: 150,
  component: () => (
    <AppShell>
      <Outlet />
    </AppShell>
  ),
})
