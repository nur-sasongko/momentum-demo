import { describe, expect, it } from 'vitest'
import { getAboutContent } from '../-queries/about-queries'

describe('about feature', () => {
  it('returns static about content', () => {
    const content = getAboutContent()

    expect(content.kicker).toBe('About')
    expect(content.title).toContain('room to grow')
    expect(content.description).toContain('TanStack Start')
  })
})
