import { createFileRoute, stripSearchParams } from '@tanstack/react-router'
import { useEffect, useState } from 'react'

import { NoteEditor } from '#/routes/_authenticated/notes/-components/note-editor'
import { NoteList } from '#/routes/_authenticated/notes/-components/note-list'
import { NotesEmptyState } from '#/routes/_authenticated/notes/-components/notes-empty-state'
import { useIsMobile } from '#/hooks/use-mobile'
import {
  noteListQueryOptions,
  noteTagsQueryOptions,
  toNotesListParams,
  useNoteLinkTargetsQuery,
  useNoteQuery,
  useNotesListParams,
  useNotesListQuery,
} from '#/routes/_authenticated/notes/-utils/notes-queries'
import {
  NOTES_SEARCH_DEFAULTS,
  notesSearchSchema,
} from '#/routes/_authenticated/notes/-utils/notes-route-search'
import { useNotesFilters } from '#/routes/_authenticated/notes/-utils/use-notes-filters'

export const Route = createFileRoute('/_authenticated/notes/')({
  head: () => ({
    meta: [{ title: 'Second Brain — Momentum' }],
  }),
  validateSearch: notesSearchSchema,
  search: {
    middlewares: [stripSearchParams(NOTES_SEARCH_DEFAULTS)],
  },
  loaderDeps: ({ search }) => ({
    q: search.q,
    tags: search.tags,
    tagMode: search.tagMode,
    untagged: search.untagged,
    fav: search.fav,
    sort: search.sort,
  }),
  loader: async ({ context: { queryClient }, deps }) => {
    const params = toNotesListParams({
      searchQuery: deps.q,
      activeTags: deps.tags,
      tagFilterMode: deps.tagMode,
      untaggedOnly: deps.untagged,
      favoritesOnly: deps.fav,
      sortBy: deps.sort,
    })
    await Promise.all([
      queryClient.ensureInfiniteQueryData(noteListQueryOptions(params)),
      queryClient.ensureQueryData(noteTagsQueryOptions()),
    ])
  },
  component: NotesPage,
})

function NotesPage() {
  const { selectedId, selectNote } = useNotesFilters()
  const isMobile = useIsMobile()
  const [mobileView, setMobileView] = useState<'list' | 'editor'>('list')

  const params = useNotesListParams()
  const listQuery = useNotesListQuery(params)
  const linkTargetsQuery = useNoteLinkTargetsQuery()
  const noteQuery = useNoteQuery(selectedId)

  const firstNoteId = listQuery.data?.pages[0]?.data[0]?.id

  useEffect(() => {
    if (!selectedId && firstNoteId) {
      selectNote(firstNoteId, { replace: true })
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
