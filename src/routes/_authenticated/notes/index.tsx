import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'

import { NoteEditor } from '#/routes/_authenticated/notes/-components/note-editor'
import { NoteList } from '#/routes/_authenticated/notes/-components/note-list'
import { NotesEmptyState } from '#/routes/_authenticated/notes/-components/notes-empty-state'
import { useIsMobile } from '#/hooks/use-mobile'
import {
  noteListQueryOptions,
  noteTagsQueryOptions,
  useNoteLinkTargetsQuery,
  useNoteQuery,
  useNotesListParams,
  useNotesListQuery,
} from '#/routes/_authenticated/notes/-utils/notes-queries'
import { useNotesStore } from '#/stores/notes-store'

const DEFAULT_LIST_PARAMS = {
  search: null,
  activeTags: [],
  tagFilterMode: 'OR' as const,
  untaggedOnly: false,
  favoritesOnly: false,
  sortBy: 'updated-desc' as const,
}

export const Route = createFileRoute('/_authenticated/notes/')({
  head: () => ({
    meta: [{ title: 'Second Brain — Momentum' }],
  }),
  loader: async ({ context: { queryClient } }) => {
    const { sortBy, favoritesOnly, tagFilterMode } = useNotesStore.getState()
    const params = {
      ...DEFAULT_LIST_PARAMS,
      sortBy,
      favoritesOnly,
      tagFilterMode,
    }
    await Promise.all([
      queryClient.ensureInfiniteQueryData(noteListQueryOptions(params)),
      queryClient.ensureQueryData(noteTagsQueryOptions()),
    ])
  },
  component: NotesPage,
})

function NotesPage() {
  const selectedId = useNotesStore((s) => s.selectedId)
  const selectNote = useNotesStore((s) => s.selectNote)
  const isMobile = useIsMobile()
  const [mobileView, setMobileView] = useState<'list' | 'editor'>('list')

  const params = useNotesListParams()
  const listQuery = useNotesListQuery(params)
  const linkTargetsQuery = useNoteLinkTargetsQuery()
  const noteQuery = useNoteQuery(selectedId)

  const firstNoteId = listQuery.data?.pages[0]?.data[0]?.id

  useEffect(() => {
    if (!selectedId && firstNoteId) {
      selectNote(firstNoteId)
    }
  }, [selectedId, firstNoteId, selectNote])

  const handleNoteSelect = () => {
    if (isMobile) setMobileView('editor')
  }

  if (listQuery.isPending) {
    return <div className="route-fade-in h-[calc(100dvh-3.5rem)]" />
  }

  const isLibraryEmpty = linkTargetsQuery.data?.length === 0

  if (isLibraryEmpty) {
    return (
      <div className="route-fade-in flex h-[calc(100dvh-3.5rem)] overflow-hidden">
        <NotesEmptyState />
      </div>
    )
  }

  return (
    <div className="route-fade-in flex h-[calc(100dvh-3.5rem)] overflow-hidden">
      {(!isMobile || mobileView === 'list') && (
        <NoteList onNoteSelect={handleNoteSelect} />
      )}
      {(!isMobile || mobileView === 'editor') && noteQuery.data ? (
        <NoteEditor
          key={noteQuery.data.id}
          note={noteQuery.data}
          onBack={isMobile ? () => setMobileView('list') : undefined}
        />
      ) : null}
    </div>
  )
}
