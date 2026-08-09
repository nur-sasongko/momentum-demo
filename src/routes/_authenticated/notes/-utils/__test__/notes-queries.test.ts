import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import { createElement } from 'react'
import { describe, expect, it, vi } from 'vitest'

import {
  NOTES_KEYS,
  buildEmptyNote,
  buildNotesListQueryParams,
  useUpdateNoteContentMutation,
} from '../notes-queries'

import type { Note } from '#/stores/notes-store'

vi.mock('#/libs/supabase/client', () => ({
  getSupabaseBrowserClient: () => ({
    from: () => ({
      update: () => ({
        eq: () => ({
          select: () => ({
            single: async () => ({
              data: {
                id: 'note-1',
                title: 'Updated title',
                excerpt: 'Updated title',
                updated_at: '2026-08-10T00:00:00.000Z',
              },
              error: null,
            }),
          }),
        }),
      }),
    }),
  }),
}))

describe('buildNotesListQueryParams', () => {
  it('has no tag filter when there are no active tags and untagged is off', () => {
    const result = buildNotesListQueryParams({
      activeTags: [],
      tagFilterMode: 'OR',
      untaggedOnly: false,
      sortBy: 'updated-desc',
    })
    expect(result.tagFilter).toEqual({ kind: 'none' })
  })

  it('produces an untagged filter when untaggedOnly is set', () => {
    const result = buildNotesListQueryParams({
      activeTags: ['Work'],
      tagFilterMode: 'OR',
      untaggedOnly: true,
      sortBy: 'updated-desc',
    })
    expect(result.tagFilter).toEqual({ kind: 'untagged' })
  })

  it('produces an overlaps filter in OR mode', () => {
    const result = buildNotesListQueryParams({
      activeTags: ['Work', 'Ideas'],
      tagFilterMode: 'OR',
      untaggedOnly: false,
      sortBy: 'updated-desc',
    })
    expect(result.tagFilter).toEqual({
      kind: 'overlaps',
      tags: ['Work', 'Ideas'],
    })
  })

  it('produces a contains filter in AND mode', () => {
    const result = buildNotesListQueryParams({
      activeTags: ['Work', 'Ideas'],
      tagFilterMode: 'AND',
      untaggedOnly: false,
      sortBy: 'updated-desc',
    })
    expect(result.tagFilter).toEqual({
      kind: 'contains',
      tags: ['Work', 'Ideas'],
    })
  })

  it.each([
    ['updated-desc', 'updated_at', false],
    ['created-desc', 'created_at', false],
    ['title-asc', 'title', true],
    ['title-desc', 'title', false],
  ] as const)(
    'maps sortBy %s to %s ascending=%s',
    (sortBy, column, ascending) => {
      const result = buildNotesListQueryParams({
        activeTags: [],
        tagFilterMode: 'OR',
        untaggedOnly: false,
        sortBy,
      })
      expect(result.order).toEqual([{ column, ascending }])
    },
  )
})

describe('buildEmptyNote', () => {
  it('returns a distinct content object on every call', () => {
    const a = buildEmptyNote()
    const b = buildEmptyNote()

    expect(a.content).toEqual(b.content)
    expect(a.content).not.toBe(b.content)
  })
})

describe('useUpdateNoteContentMutation', () => {
  it('writes the saved content into the detail cache on success', async () => {
    const queryClient = new QueryClient()
    const staleNote: Note = {
      id: 'note-1',
      title: 'Old title',
      excerpt: 'Old title',
      tags: [],
      isFavorite: false,
      isReadOnly: false,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      content: { type: 'doc', content: [{ type: 'paragraph' }] },
    }
    queryClient.setQueryData(NOTES_KEYS.detail('note-1'), staleNote)

    const { result } = renderHook(() => useUpdateNoteContentMutation(), {
      wrapper: ({ children }) =>
        createElement(QueryClientProvider, { client: queryClient }, children),
    })

    const savedContent = {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'Saved' }] },
      ],
    }

    act(() => {
      result.current.mutate({
        id: 'note-1',
        title: 'Updated title',
        content: savedContent,
        plainText: 'Saved',
      })
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(
      queryClient.getQueryData<Note>(NOTES_KEYS.detail('note-1')),
    ).toMatchObject({
      title: 'Updated title',
      content: savedContent,
    })
  })
})
