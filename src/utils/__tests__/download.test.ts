import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { downloadBlob, slugify } from '#/utils/download'

describe('slugify', () => {
  it('lowercases and hyphenates punctuation and spaces', () => {
    expect(slugify('Compounding attention: a note!')).toBe(
      'compounding-attention-a-note',
    )
  })

  it('strips diacritics', () => {
    expect(slugify('Café résumé')).toBe('cafe-resume')
  })

  it('drops emoji entirely', () => {
    expect(slugify('Launch 🚀 plan')).toBe('launch-plan')
  })

  it('falls back when the title is blank', () => {
    expect(slugify('   ')).toBe('untitled')
  })

  it('falls back when nothing alphanumeric survives (pure punctuation/emoji)', () => {
    expect(slugify('🚀🚀🚀')).toBe('untitled')
    expect(slugify('!!!')).toBe('untitled')
  })

  it('uses a custom fallback when provided', () => {
    expect(slugify('', 'untitled-note')).toBe('untitled-note')
  })

  it('collapses repeated separators and trims leading/trailing hyphens', () => {
    expect(slugify('  -- multiple   spaces -- ')).toBe('multiple-spaces')
  })
})

describe('downloadBlob', () => {
  const originalCreateObjectURL = URL.createObjectURL
  const originalRevokeObjectURL = URL.revokeObjectURL

  beforeEach(() => {
    URL.createObjectURL = vi.fn(() => 'blob:mock-url')
    URL.revokeObjectURL = vi.fn()
    vi.useFakeTimers()
  })

  afterEach(() => {
    URL.createObjectURL = originalCreateObjectURL
    URL.revokeObjectURL = originalRevokeObjectURL
    vi.useRealTimers()
  })

  it('creates an object URL and clicks a temporary anchor with the given filename', () => {
    const clickSpy = vi.fn()
    const anchor = document.createElement('a')
    anchor.click = clickSpy
    const createElementSpy = vi
      .spyOn(document, 'createElement')
      .mockReturnValue(anchor)

    downloadBlob(new Blob(['content']), 'note.pdf')

    expect(URL.createObjectURL).toHaveBeenCalledTimes(1)
    expect(anchor.href).toBe('blob:mock-url')
    expect(anchor.download).toBe('note.pdf')
    expect(clickSpy).toHaveBeenCalledTimes(1)

    createElementSpy.mockRestore()
  })

  it('never appends the anchor to the document', () => {
    const appendSpy = vi.spyOn(document.body, 'appendChild')
    downloadBlob(new Blob(['content']), 'note.pdf')
    expect(appendSpy).not.toHaveBeenCalled()
    appendSpy.mockRestore()
  })

  it('revokes the object URL after the download fires', () => {
    downloadBlob(new Blob(['content']), 'note.pdf')
    expect(URL.revokeObjectURL).not.toHaveBeenCalled()

    vi.runAllTimers()

    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url')
  })
})
