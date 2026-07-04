import { getSupabaseBrowserClient } from '#/libs/supabase/client'

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

// Client-only, unverified: reads the local session from storage without
// contacting Supabase Auth. There is no server to revalidate against in a
// static SPA build, so this is the app's only auth check — acceptable since
// no remote data is gated behind it (habits/finance/notes are local-only).
export async function getUser(): Promise<AppUser | null> {
  const supabase = getSupabaseBrowserClient()
  const { data } = await supabase.auth.getSession()
  return data.session?.user ?? null
}

export async function getSession() {
  const supabase = getSupabaseBrowserClient()
  const { data } = await supabase.auth.getSession()
  return data.session
}
