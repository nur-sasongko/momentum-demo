import { createClient } from '@supabase/supabase-js'
import { env } from '#/libs/env'

import type { SupabaseClient } from '@supabase/supabase-js'

let browserClient: SupabaseClient | undefined

export function getSupabaseBrowserClient(): SupabaseClient {
  browserClient ??= createClient(
    env.VITE_SUPABASE_URL,
    env.VITE_SUPABASE_PUBLISHABLE_KEY,
  )
  return browserClient
}
