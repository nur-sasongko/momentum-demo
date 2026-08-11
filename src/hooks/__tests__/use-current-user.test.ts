import { renderHook } from '@testing-library/react'
import { useRouteContext } from '@tanstack/react-router'
import { describe, expect, it, vi } from 'vitest'

import { useCurrentUser } from '#/hooks/use-current-user'

import type { AppUser } from '#/libs/auth/auth-adapter'

vi.mock('@tanstack/react-router', () => ({
  useRouteContext: vi.fn(),
}))

const mockUseRouteContext = vi.mocked(useRouteContext)

function mockRootUser(user: AppUser | null) {
  mockUseRouteContext.mockImplementation(
    (opts: unknown) =>
      (
        opts as { select: (ctx: { user: AppUser | null }) => AppUser | null }
      ).select({ user }) as never,
  )
}

describe('useCurrentUser', () => {
  it('returns the user from the root route context', () => {
    const user = { id: 'user-1', email: 'a@b.com' } as AppUser
    mockRootUser(user)

    const { result } = renderHook(() => useCurrentUser())

    expect(result.current).toBe(user)
    expect(mockUseRouteContext).toHaveBeenCalledWith(
      expect.objectContaining({ from: '__root__' }),
    )
  })

  it('returns null when unauthenticated', () => {
    mockRootUser(null)

    const { result } = renderHook(() => useCurrentUser())

    expect(result.current).toBeNull()
  })
})
