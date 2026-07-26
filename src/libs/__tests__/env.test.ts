import { describe, expect, it } from 'vitest'
import { parseEnv } from '#/libs/env'

describe('parseEnv', () => {
  it('returns parsed data for valid input', () => {
    const result = parseEnv({
      VITE_SUPABASE_URL: 'https://example.supabase.co',
      VITE_SUPABASE_PUBLISHABLE_KEY: 'publishable-key',
      VITE_GOOGLE_MAPS_API_KEY: 'maps-key',
    })

    expect(result).toEqual({
      VITE_SUPABASE_URL: 'https://example.supabase.co',
      VITE_SUPABASE_PUBLISHABLE_KEY: 'publishable-key',
      VITE_GOOGLE_MAPS_API_KEY: 'maps-key',
    })
  })

  it('throws naming the missing key when a var is absent', () => {
    expect(() =>
      parseEnv({
        VITE_SUPABASE_PUBLISHABLE_KEY: 'publishable-key',
        VITE_GOOGLE_MAPS_API_KEY: 'maps-key',
      }),
    ).toThrow(/VITE_SUPABASE_URL/)
  })

  it('throws naming the invalid key when a var is malformed', () => {
    expect(() =>
      parseEnv({
        VITE_SUPABASE_URL: 'not-a-url',
        VITE_SUPABASE_PUBLISHABLE_KEY: 'publishable-key',
        VITE_GOOGLE_MAPS_API_KEY: 'maps-key',
      }),
    ).toThrow(/VITE_SUPABASE_URL/)
  })

  it('throws naming the missing key when the Google Maps API key is absent', () => {
    expect(() =>
      parseEnv({
        VITE_SUPABASE_URL: 'https://example.supabase.co',
        VITE_SUPABASE_PUBLISHABLE_KEY: 'publishable-key',
      }),
    ).toThrow(/VITE_GOOGLE_MAPS_API_KEY/)
  })
})
