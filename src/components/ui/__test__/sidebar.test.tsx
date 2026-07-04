import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { Sidebar, SidebarProvider, useSidebar } from '#/components/ui/sidebar'

function mockMatchMedia() {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  })
}

function SidebarStateProbe() {
  const { open } = useSidebar()

  return <div data-testid="sidebar-open">{String(open)}</div>
}

describe('SidebarProvider', () => {
  beforeEach(() => {
    mockMatchMedia()
  })

  it('starts collapsed by default', () => {
    render(
      <SidebarProvider>
        <SidebarStateProbe />
      </SidebarProvider>,
    )

    expect(screen.getByTestId('sidebar-open').textContent).toBe('false')
  })
})

describe('Sidebar hover behavior', () => {
  beforeEach(() => {
    mockMatchMedia()
  })

  it('opens on mouse enter and closes on mouse leave', () => {
    render(
      <SidebarProvider>
        <Sidebar data-testid="sidebar" />
        <SidebarStateProbe />
      </SidebarProvider>,
    )

    const sidebar = screen.getByTestId('sidebar')
    expect(screen.getByTestId('sidebar-open').textContent).toBe('false')

    fireEvent.mouseEnter(sidebar)
    expect(screen.getByTestId('sidebar-open').textContent).toBe('true')

    fireEvent.mouseLeave(sidebar)
    expect(screen.getByTestId('sidebar-open').textContent).toBe('false')
  })
})
