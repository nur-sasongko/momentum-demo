import { afterEach, describe, expect, it, vi } from 'vitest'

import { getSaveShortcutLabel } from '#/utils/platform'

describe('getSaveShortcutLabel', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns the Mac shortcut label on macOS', () => {
    vi.stubGlobal('navigator', { platform: 'MacIntel' })
    expect(getSaveShortcutLabel()).toBe('⌘S')
  })

  it('returns the Mac shortcut label on iOS', () => {
    vi.stubGlobal('navigator', { platform: 'iPhone' })
    expect(getSaveShortcutLabel()).toBe('⌘S')
  })

  it('returns the Windows/Linux shortcut label otherwise', () => {
    vi.stubGlobal('navigator', { platform: 'Win32' })
    expect(getSaveShortcutLabel()).toBe('Ctrl+S')
  })
})
