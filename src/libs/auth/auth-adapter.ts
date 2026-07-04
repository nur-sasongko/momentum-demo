import { createIsomorphicFn } from '@tanstack/react-start'
import { getSupabaseBrowserClient } from '#/libs/supabase/client'
import { getSupabaseServerClient } from '#/libs/supabase/server'

import type { User } from '@supabase/supabase-js'

export type AppUser = User

export async function signInWithPassword(email: string, password: string) {
  const supabase = getSupabaseBrowserClient()
  return supabase.auth.signInWithPassword({ email, password })
}

export async function signOut() {
  const supabase = getSupabaseBrowserClient()
  return supabase.auth.signOut()
}

// Server branch: revalidates against Supabase Auth. This is the real security
// boundary (SSR / full page loads render protected content based on this).
// Client branch: reads the local session cookie only, no network round-trip.
// Root beforeLoad re-runs this on every SPA navigation, so the client branch
// intentionally trades network-verified freshness for UX — a revoked session
// won't be caught client-side until the next full page load.
export const getUser = createIsomorphicFn()
  .server(async (): Promise<AppUser | null> => {
    const supabase = getSupabaseServerClient()
    const { data, error } = await supabase.auth.getUser()
    return error ? null : data.user
  })
  .client(async (): Promise<AppUser | null> => {
    const supabase = getSupabaseBrowserClient()
    const { data } = await supabase.auth.getSession()
    return data.session?.user ?? null
  })

// Cheap, local, unverified — exposed directly for any future non-security-critical reads.
export const getSession = createIsomorphicFn()
  .server(async () => {
    const supabase = getSupabaseServerClient()
    const { data } = await supabase.auth.getSession()
    return data.session
  })
  .client(async () => {
    const supabase = getSupabaseBrowserClient()
    const { data } = await supabase.auth.getSession()
    return data.session
  })
