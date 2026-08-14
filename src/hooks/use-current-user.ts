import { useRouteContext } from '@tanstack/react-router'

import type { AppUser } from '#/libs/auth/auth-adapter'

/**
 * Returns the current authenticated user from the root route's context,
 * or `null` when unauthenticated.
 */
export function useCurrentUser(): AppUser | null {
  return useRouteContext({ from: '__root__', select: (c) => c.user })
}
