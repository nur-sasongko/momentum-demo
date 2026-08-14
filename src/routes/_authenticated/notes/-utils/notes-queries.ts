import type { JSONContent } from '@tiptap/core'
import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { useMemo } from 'react'
import { toast } from 'sonner'

import { useCurrentUser } from '#/hooks/use-current-user'
import { getSupabaseBrowserClient } from '#/libs/supabase/client'
import type { Note, NoteSummary } from '#/stores/notes-store'
import { useNotesStore } from '#/stores/notes-store'
import { buildNotesTsQuery } from './notes-search'
import type { NotesSortBy, TagFilterMode } from './notes-route-search'
import { useNotesFilters } from './use-notes-filters'

import type { NoteRow, NoteSummaryRow } from '../-types/notes-api'
import type {
  NoteTagCount,
  NotesListPage,
  NotesListParams,
  NotesListQueryDescriptor,
  NotesOrder,
  NotesTagFilter,
} from '../-types/notes-query'

export const PAGE_SIZE = 30

function buildEmptyDoc(): JSONContent {
  return { type: 'doc', content: [{ type: 'paragraph' }] }
}

export function buildEmptyNote(): Note {
  const now = new Date().toISOString()
  return {
    id: crypto.randomUUID(),
    title: 'Untitled',
    excerpt: '',
    tags: [],
    isFavorite: false,
    isReadOnly: false,
    createdAt: now,
    updatedAt: now,
    content: buildEmptyDoc(),
  }
}

/** Normalizes raw filter/sort values into a `NotesListParams` cache key. */
export function toNotesListParams(input: {
  searchQuery: string
  activeTags: string[]
  tagFilterMode: TagFilterMode
  untaggedOnly: boolean
  favoritesOnly: boolean
  sortBy: NotesSortBy
}): NotesListParams {
  return {
    search: input.searchQuery.trim() ? input.searchQuery.trim() : null,
    activeTags: [...input.activeTags].sort(),
    tagFilterMode: input.tagFilterMode,
    untaggedOnly: input.untaggedOnly,
    favoritesOnly: input.favoritesOnly,
    sortBy: input.sortBy,
  }
}

/** Reads the URL's filter/sort state into a `NotesListParams` cache key. */
export function useNotesListParams(): NotesListParams {
  const {
    searchQuery,
    activeTags,
    tagFilterMode,
    untaggedOnly,
    favoritesOnly,
    sortBy,
  } = useNotesFilters()

  return useMemo(
    () =>
      toNotesListParams({
        searchQuery,
        activeTags,
        tagFilterMode,
        untaggedOnly,
        favoritesOnly,
        sortBy,
      }),
    [
      searchQuery,
      activeTags,
      tagFilterMode,
      untaggedOnly,
      favoritesOnly,
      sortBy,
    ],
  )
}

// ---------------------------------------------------------------------------
// Query key factory
// ---------------------------------------------------------------------------

export const NOTES_KEYS = {
  list: (params: NotesListParams) => ['notes', 'list', params] as const,
  detail: (id: string) => ['notes', 'detail', id] as const,
  tags: ['notes', 'tags'] as const,
  linkTargets: ['notes', 'link-targets'] as const,
}

// ---------------------------------------------------------------------------
// Transformers
// ---------------------------------------------------------------------------

function transformNoteSummary(row: NoteSummaryRow): NoteSummary {
  return {
    id: row.id,
    title: row.title,
    excerpt: row.excerpt,
    tags: row.tags,
    isFavorite: row.is_favorite,
    isReadOnly: row.is_read_only,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function transformNote(row: NoteRow): Note {
  return {
    ...transformNoteSummary(row),
    content: row.content,
  }
}

// ---------------------------------------------------------------------------
// Filter/sort mapping — pure function, testable without a Supabase client
// ---------------------------------------------------------------------------

const SORT_ORDER: Record<NotesSortBy, NotesOrder> = {
  'updated-desc': { column: 'updated_at', ascending: false },
  'created-desc': { column: 'created_at', ascending: false },
  'title-asc': { column: 'title', ascending: true },
  'title-desc': { column: 'title', ascending: false },
}

export function buildNotesListQueryParams(filters: {
  activeTags: string[]
  tagFilterMode: TagFilterMode
  untaggedOnly: boolean
  sortBy: NotesSortBy
}): NotesListQueryDescriptor {
  const { activeTags, tagFilterMode, untaggedOnly, sortBy } = filters

  let tagFilter: NotesTagFilter = { kind: 'none' }
  if (untaggedOnly) {
    tagFilter = { kind: 'untagged' }
  } else if (activeTags.length > 0) {
    tagFilter =
      tagFilterMode === 'AND'
        ? { kind: 'contains', tags: activeTags }
        : { kind: 'overlaps', tags: activeTags }
  }

  return { tagFilter, order: [SORT_ORDER[sortBy]] }
}

// ---------------------------------------------------------------------------
// 1. Paginated list query (infinite scroll)
// ---------------------------------------------------------------------------

export function noteListQueryOptions(params: NotesListParams) {
  return {
    queryKey: NOTES_KEYS.list(params),
    queryFn: async ({
      pageParam,
    }: {
      pageParam: number
    }): Promise<NotesListPage> => {
      const supabase = getSupabaseBrowserClient()
      const from = pageParam * PAGE_SIZE
      const to = from + PAGE_SIZE - 1

      let q = supabase
        .from('notes')
        .select(
          'id, title, excerpt, tags, is_favorite, is_read_only, created_at, updated_at',
        )

      const { tagFilter, order } = buildNotesListQueryParams(params)
      if (tagFilter.kind === 'untagged') q = q.filter('tags', 'eq', '{}')
      else if (tagFilter.kind === 'overlaps')
        q = q.overlaps('tags', tagFilter.tags)
      else if (tagFilter.kind === 'contains')
        q = q.contains('tags', tagFilter.tags)

      if (params.favoritesOnly) q = q.eq('is_favorite', true)

      const tsQuery = params.search ? buildNotesTsQuery(params.search) : null
      if (tsQuery) q = q.textSearch('search_vector', tsQuery)

      for (const { column, ascending } of order) {
        q = q.order(column, { ascending })
      }
      q = q.order('id').range(from, to)

      const { data, error } = await q
      if (error) throw error

      return { data: data.map(transformNoteSummary) }
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage: NotesListPage, pages: NotesListPage[]) =>
      lastPage.data.length === PAGE_SIZE ? pages.length : undefined,
    staleTime: 30 * 1000,
    placeholderData: keepPreviousData,
  }
}

export function useNotesListQuery(params: NotesListParams) {
  return useInfiniteQuery(noteListQueryOptions(params))
}

// ---------------------------------------------------------------------------
// 2. Single note by id (with content)
// ---------------------------------------------------------------------------

export function useNoteQuery(id: string | null) {
  return useQuery({
    queryKey: NOTES_KEYS.detail(id ?? ''),
    queryFn: async (): Promise<Note> => {
      const supabase = getSupabaseBrowserClient()
      const { data, error } = await supabase
        .from('notes')
        .select('*')
        .eq('id', id as string)
        .single()

      if (error) throw error
      return transformNote(data as NoteRow)
    },
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  })
}

// ---------------------------------------------------------------------------
// 3. Tags aggregate (chips + Tag Manager)
// ---------------------------------------------------------------------------

export function noteTagsQueryOptions() {
  return {
    queryKey: NOTES_KEYS.tags,
    queryFn: async (): Promise<NoteTagCount[]> => {
      const supabase = getSupabaseBrowserClient()
      const { data, error } = await supabase.rpc('get_note_tags')
      if (error) throw error

      return (data as Array<{ tag: string; note_count: number }>).map(
        (row) => ({ tag: row.tag, noteCount: row.note_count }),
      )
    },
    staleTime: 30 * 1000,
  }
}

export function useNoteTagsQuery() {
  return useQuery(noteTagsQueryOptions())
}

// ---------------------------------------------------------------------------
// 4. Whole-library link targets for the `[[` menu
// ---------------------------------------------------------------------------

export function useNoteLinkTargetsQuery() {
  const setLinkTargets = useNotesStore((s) => s.setLinkTargets)

  return useQuery({
    queryKey: NOTES_KEYS.linkTargets,
    queryFn: async (): Promise<NoteSummary[]> => {
      const supabase = getSupabaseBrowserClient()
      const { data, error } = await supabase
        .from('notes')
        .select(
          'id, title, excerpt, tags, is_favorite, is_read_only, created_at, updated_at',
        )
        .order('title')

      if (error) throw error

      const targets = data.map(transformNoteSummary)
      setLinkTargets(targets)
      return targets
    },
    staleTime: 60 * 1000,
  })
}

// ---------------------------------------------------------------------------
// Cache-patch helpers for the content-save mutation
// ---------------------------------------------------------------------------

function patchListCaches(
  queryClient: ReturnType<typeof useQueryClient>,
  id: string,
  patch: Partial<NoteSummary>,
) {
  queryClient.setQueriesData<{ pages: NotesListPage[]; pageParams: number[] }>(
    { queryKey: ['notes', 'list'] },
    (old) => {
      if (!old) return old
      return {
        ...old,
        pages: old.pages.map((page) => ({
          ...page,
          data: page.data.map((note) =>
            note.id === id ? { ...note, ...patch } : note,
          ),
        })),
      }
    },
  )
}

function prependToListCaches(
  queryClient: ReturnType<typeof useQueryClient>,
  summary: NoteSummary,
) {
  queryClient.setQueriesData<{ pages: NotesListPage[]; pageParams: number[] }>(
    { queryKey: ['notes', 'list'] },
    (old) => {
      if (!old || old.pages.length === 0) return old
      const [firstPage, ...rest] = old.pages
      return {
        ...old,
        pages: [{ ...firstPage, data: [summary, ...firstPage.data] }, ...rest],
      }
    },
  )
}

function removeFromListCaches(
  queryClient: ReturnType<typeof useQueryClient>,
  id: string,
) {
  queryClient.setQueriesData<{ pages: NotesListPage[]; pageParams: number[] }>(
    { queryKey: ['notes', 'list'] },
    (old) => {
      if (!old) return old
      return {
        ...old,
        pages: old.pages.map((page) => ({
          ...page,
          data: page.data.filter((note) => note.id !== id),
        })),
      }
    },
  )
}

function addToLinkTargetsCache(
  queryClient: ReturnType<typeof useQueryClient>,
  summary: NoteSummary,
) {
  queryClient.setQueryData<NoteSummary[]>(NOTES_KEYS.linkTargets, (old) =>
    old ? [...old, summary] : old,
  )
}

function removeFromLinkTargetsCache(
  queryClient: ReturnType<typeof useQueryClient>,
  id: string,
) {
  queryClient.setQueryData<NoteSummary[]>(NOTES_KEYS.linkTargets, (old) =>
    old ? old.filter((note) => note.id !== id) : old,
  )
}

function invalidateTagsAndList(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ['notes', 'list'] })
  queryClient.invalidateQueries({ queryKey: NOTES_KEYS.tags })
}

function replaceActiveTag(
  activeTags: string[],
  setActiveTags: (tags: string[]) => void,
  oldTag: string,
  newTag: string | null,
) {
  const lowerOld = oldTag.toLowerCase()
  if (!activeTags.some((t) => t.toLowerCase() === lowerOld)) return

  setActiveTags(
    newTag === null
      ? activeTags.filter((t) => t.toLowerCase() !== lowerOld)
      : activeTags.map((t) => (t.toLowerCase() === lowerOld ? newTag : t)),
  )
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

/**
 * Writes a freshly-created note into the query cache immediately, before the
 * insert round-trips — so the editor can mount against it with no wait.
 * Call this (then `selectNote(note.id)`) synchronously in the click handler,
 * ahead of `useCreateNoteMutation().mutate(note)`.
 */
export function seedOptimisticNote(
  queryClient: ReturnType<typeof useQueryClient>,
  note: Note,
) {
  queryClient.setQueryData(NOTES_KEYS.detail(note.id), note)
  prependToListCaches(queryClient, note)
  addToLinkTargetsCache(queryClient, note)
}

export function useCreateNoteMutation() {
  const queryClient = useQueryClient()
  const user = useCurrentUser()

  return useMutation({
    mutationFn: async (note: Note) => {
      if (!user) throw new Error('Not authenticated')
      const supabase = getSupabaseBrowserClient()
      const { error } = await supabase.from('notes').insert({
        id: note.id,
        user_id: user.id,
        title: note.title,
        content: note.content,
        plain_text: '',
        tags: note.tags,
      })

      if (error) throw error
      return note
    },
    onError: (_error, note) => {
      removeFromListCaches(queryClient, note.id)
      removeFromLinkTargetsCache(queryClient, note.id)
      queryClient.removeQueries({ queryKey: NOTES_KEYS.detail(note.id) })
      toast.error('Failed to create note.')
    },
  })
}

export function useUpdateNoteContentMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: {
      id: string
      title: string
      content: JSONContent
      plainText: string
    }) => {
      const supabase = getSupabaseBrowserClient()
      const { data, error } = await supabase
        .from('notes')
        .update({
          title: input.title,
          content: input.content,
          plain_text: input.plainText,
        })
        .eq('id', input.id)
        .select('id, title, excerpt, updated_at')
        .single()

      if (error) throw error
      const row: Pick<NoteRow, 'id' | 'title' | 'excerpt' | 'updated_at'> = data
      return row
    },
    onSuccess: (row, variables) => {
      const summaryPatch = {
        title: row.title,
        excerpt: row.excerpt,
        updatedAt: row.updated_at,
      }
      patchListCaches(queryClient, row.id, summaryPatch)
      queryClient.setQueryData<Note>(NOTES_KEYS.detail(row.id), (old) =>
        old ? { ...old, ...summaryPatch, content: variables.content } : old,
      )
    },
    onError: () => {
      toast.error('Failed to save note. Your changes are kept — try again.')
    },
  })
}

export function useUpdateNoteMetaMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: {
      id: string
      patch: Partial<Pick<Note, 'tags' | 'isFavorite' | 'isReadOnly'>>
    }) => {
      const columns: Record<string, unknown> = {}
      if (input.patch.tags !== undefined) columns.tags = input.patch.tags
      if (input.patch.isFavorite !== undefined)
        columns.is_favorite = input.patch.isFavorite
      if (input.patch.isReadOnly !== undefined)
        columns.is_read_only = input.patch.isReadOnly

      const supabase = getSupabaseBrowserClient()
      const { error } = await supabase
        .from('notes')
        .update(columns)
        .eq('id', input.id)

      if (error) throw error
      return input
    },
    onSuccess: ({ id, patch }) => {
      patchListCaches(queryClient, id, patch)
      queryClient.setQueryData<Note>(NOTES_KEYS.detail(id), (old) =>
        old ? { ...old, ...patch } : old,
      )
      if (patch.tags !== undefined) {
        queryClient.invalidateQueries({ queryKey: NOTES_KEYS.tags })
      }
    },
    onError: () => {
      toast.error('Failed to update note.')
    },
  })
}

export function useDeleteNoteMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const supabase = getSupabaseBrowserClient()
      const { error } = await supabase.from('notes').delete().eq('id', id)
      if (error) throw error
      return id
    },
    onSuccess: (id) => {
      queryClient.invalidateQueries({ queryKey: ['notes', 'list'] })
      queryClient.invalidateQueries({ queryKey: NOTES_KEYS.tags })
      queryClient.invalidateQueries({ queryKey: NOTES_KEYS.linkTargets })
      queryClient.removeQueries({ queryKey: NOTES_KEYS.detail(id) })
    },
    onError: () => {
      toast.error('Failed to delete note.')
    },
  })
}

export function useRenameTagMutation() {
  const queryClient = useQueryClient()
  const { activeTags, setActiveTags } = useNotesFilters()

  return useMutation({
    mutationFn: async (input: { oldTag: string; newTag: string }) => {
      const supabase = getSupabaseBrowserClient()
      const { error } = await supabase.rpc('rename_note_tag', {
        old_tag: input.oldTag,
        new_tag: input.newTag,
      })
      if (error) throw error
      return input
    },
    onSuccess: ({ oldTag, newTag }) => {
      invalidateTagsAndList(queryClient)
      replaceActiveTag(activeTags, setActiveTags, oldTag, newTag)
    },
    onError: () => {
      toast.error('Failed to rename tag.')
    },
  })
}

export function useDeleteTagMutation() {
  const queryClient = useQueryClient()
  const { activeTags, setActiveTags } = useNotesFilters()

  return useMutation({
    mutationFn: async (targetTag: string) => {
      const supabase = getSupabaseBrowserClient()
      const { error } = await supabase.rpc('delete_note_tag', {
        target_tag: targetTag,
      })
      if (error) throw error
      return targetTag
    },
    onSuccess: (targetTag) => {
      invalidateTagsAndList(queryClient)
      replaceActiveTag(activeTags, setActiveTags, targetTag, null)
    },
    onError: () => {
      toast.error('Failed to delete tag.')
    },
  })
}
