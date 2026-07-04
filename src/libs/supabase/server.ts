import { createServerClient } from '@supabase/ssr'
import { createServerOnlyFn } from '@tanstack/react-start'
import { getCookies, setCookie } from '@tanstack/react-start/server'
import { env } from '#/libs/env'

import type { SupabaseClient } from '@supabase/supabase-js'

export const getSupabaseServerClient = createServerOnlyFn(
  (): SupabaseClient =>
    createServerClient(
      env.VITE_SUPABASE_URL,
      env.VITE_SUPABASE_PUBLISHABLE_KEY,
      {
        cookies: {
          getAll() {
            return Object.entries(getCookies()).map(([name, value]) => ({
              name,
              value,
            }))
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              setCookie(name, value, options)
            })
          },
        },
      },
    ),
)
