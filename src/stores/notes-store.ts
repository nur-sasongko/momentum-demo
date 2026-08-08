import type { JSONContent } from '@tiptap/core'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/** List-pane row — everything except the body. */
export interface NoteSummary {
  id: string
  title: string
  excerpt: string
  tags: string[]
  isFavorite: boolean
  isReadOnly: boolean
  createdAt: string
  updatedAt: string
}

/** A fully loaded note. */
export interface Note extends NoteSummary {
  content: JSONContent
}

export type TagFilterMode = 'AND' | 'OR'
export type NotesSortBy =
  | 'updated-desc'
  | 'created-desc'
  | 'title-asc'
  | 'title-desc'

interface NotesState {
  selectedId: string | null
  searchQuery: string
  activeTags: string[]
  tagFilterMode: TagFilterMode
  untaggedOnly: boolean
  favoritesOnly: boolean
  sortBy: NotesSortBy
  linkTargets: NoteSummary[]
  selectNote: (id: string | null) => void
  setSearch: (query: string) => void
  setActiveTags: (tags: string[]) => void
  toggleActiveTag: (tag: string) => void
  setTagFilterMode: (mode: TagFilterMode) => void
  setUntaggedOnly: (value: boolean) => void
  setFavoritesOnly: (value: boolean) => void
  setSortBy: (sort: NotesSortBy) => void
  setLinkTargets: (targets: NoteSummary[]) => void
}

export const useNotesStore = create<NotesState>()(
  persist(
    (set, get) => ({
      selectedId: null,
      searchQuery: '',
      activeTags: [],
      tagFilterMode: 'OR',
      untaggedOnly: false,
      favoritesOnly: false,
      sortBy: 'updated-desc',
      linkTargets: [],
      selectNote: (id) => set({ selectedId: id }),
      setSearch: (query) => set({ searchQuery: query }),
      setActiveTags: (tags) =>
        set({
          activeTags: tags,
          untaggedOnly: tags.length > 0 ? false : get().untaggedOnly,
        }),
      toggleActiveTag: (tag) =>
        set((state) => {
          const exists = state.activeTags.includes(tag)
          const nextTags = exists
            ? state.activeTags.filter((t) => t !== tag)
            : [...state.activeTags, tag]
          return {
            activeTags: nextTags,
            untaggedOnly: nextTags.length > 0 ? false : state.untaggedOnly,
          }
        }),
      setTagFilterMode: (mode) => set({ tagFilterMode: mode }),
      setUntaggedOnly: (value) =>
        set({
          untaggedOnly: value,
          activeTags: value ? [] : get().activeTags,
        }),
      setFavoritesOnly: (value) => set({ favoritesOnly: value }),
      setSortBy: (sort) => set({ sortBy: sort }),
      setLinkTargets: (targets) => set({ linkTargets: targets }),
    }),
    {
      name: 'myspace-notes',
      version: 5,
      migrate: () => ({
        sortBy: 'updated-desc',
        favoritesOnly: false,
        tagFilterMode: 'OR',
      }),
      partialize: (state) => ({
        sortBy: state.sortBy,
        favoritesOnly: state.favoritesOnly,
        tagFilterMode: state.tagFilterMode,
      }),
    },
  ),
)
