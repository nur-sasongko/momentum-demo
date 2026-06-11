import type { JSONContent } from '@tiptap/core'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import { buildSeedContent } from '#/routes/notes/-utils/tiptap-content'

export interface Note {
  id: string
  title: string
  content: JSONContent
  tags: string[]
  createdAt: string
  updatedAt: string
  isFavorite: boolean
  isReadOnly: boolean
}

function normalizeNote(note: Note & { isReadOnly?: boolean }): Note {
  return {
    ...note,
    isReadOnly: note.isReadOnly === true,
  }
}

function daysAgo(days: number, minutesOffset = 0): string {
  return new Date(
    Date.now() - days * 86400000 - minutesOffset * 60000,
  ).toISOString()
}

export const SEED_NOTES: Note[] = [
  {
    id: 'note-welcome',
    title: 'Welcome to MySpace',
    content: buildSeedContent([
      { type: 'heading', level: 1, text: 'Welcome to MySpace' },
      {
        type: 'paragraph',
        text: 'Your personal space for notes, habits, and finance — all in one place.',
      },
      { type: 'heading', level: 2, text: 'Getting started' },
      {
        type: 'bulletList',
        items: [
          'Capture ideas in Second Brain',
          'Track daily habits',
          'Plan your finances',
        ],
      },
    ]),
    tags: ['Personal'],
    createdAt: daysAgo(14),
    updatedAt: daysAgo(0, 20),
    isFavorite: true,
    isReadOnly: false,
  },
  {
    id: 'note-deep-work',
    title: 'Book: Deep Work',
    content: buildSeedContent([
      { type: 'heading', level: 1, text: 'Deep Work — Cal Newport' },
      { type: 'paragraph', text: 'Key ideas to revisit:' },
      {
        type: 'bulletList',
        items: [
          'Focus blocks without distraction',
          'Shallow work batching',
          'Rituals for deep sessions',
        ],
      },
    ]),
    tags: ['Reading', 'Ideas'],
    createdAt: daysAgo(10),
    updatedAt: daysAgo(1),
    isFavorite: false,
    isReadOnly: false,
  },
  {
    id: 'note-q3-planning',
    title: 'Q3 Planning',
    content: buildSeedContent([
      { type: 'heading', level: 2, text: 'Goals' },
      {
        type: 'bulletList',
        items: [
          'Ship habits module polish',
          'Second Brain MVP',
          'Finance tracker v1',
        ],
      },
      { type: 'heading', level: 2, text: 'Open questions' },
      {
        type: 'bulletList',
        items: ['Mobile layout priorities', 'Sync strategy later'],
      },
    ]),
    tags: ['Work'],
    createdAt: daysAgo(8),
    updatedAt: daysAgo(2),
    isFavorite: false,
    isReadOnly: false,
  },
  {
    id: 'note-ideas-backlog',
    title: 'Ideas backlog',
    content: buildSeedContent([
      { type: 'heading', level: 2, text: 'Things to explore' },
      {
        type: 'bulletList',
        items: [
          'A daily review template',
          'Weekly finance check-in',
          'Habit "missed day" recovery flow',
        ],
      },
    ]),
    tags: ['Ideas'],
    createdAt: daysAgo(12),
    updatedAt: daysAgo(4),
    isFavorite: false,
    isReadOnly: false,
  },
  {
    id: 'note-miso-pasta',
    title: 'Recipe — Miso pasta',
    content: buildSeedContent([
      { type: 'heading', level: 2, text: 'Ingredients' },
      {
        type: 'paragraph',
        text: 'Pasta, miso paste, butter, garlic, parmesan',
      },
      { type: 'heading', level: 2, text: 'Steps' },
      {
        type: 'orderedList',
        items: [
          'Cook pasta al dente',
          'Sauté garlic in butter',
          'Whisk miso with pasta water',
          'Toss and finish with parmesan',
        ],
      },
    ]),
    tags: ['Personal'],
    createdAt: daysAgo(20),
    updatedAt: daysAgo(6),
    isFavorite: false,
    isReadOnly: false,
  },
  {
    id: 'note-design-sync',
    title: 'Meeting notes — Design sync',
    content: buildSeedContent([
      { type: 'heading', level: 2, text: 'Attendees' },
      { type: 'paragraph', text: 'Design + eng' },
      { type: 'heading', level: 2, text: 'Decisions' },
      {
        type: 'bulletList',
        items: [
          'Split view for notes',
          'Tag chips above list',
          'WYSIWYG editor with slash commands',
        ],
      },
    ]),
    tags: ['Work'],
    createdAt: daysAgo(15),
    updatedAt: daysAgo(8),
    isFavorite: false,
    isReadOnly: false,
  },
  {
    id: 'note-slow-productivity',
    title: 'Article — On slow productivity',
    content: buildSeedContent([
      { type: 'paragraph', text: 'Takeaways:' },
      {
        type: 'bulletList',
        items: [
          'Fewer priorities, deeper work',
          'Protect mornings for creative tasks',
          'Batch admin in afternoon blocks',
        ],
      },
    ]),
    tags: ['Reading'],
    createdAt: daysAgo(18),
    updatedAt: daysAgo(11),
    isFavorite: false,
    isReadOnly: false,
  },
  {
    id: 'note-lisbon',
    title: 'Travel — Lisbon shortlist',
    content: buildSeedContent([
      { type: 'heading', level: 2, text: 'Places' },
      {
        type: 'bulletList',
        items: ['Alfama walk', 'Time Out Market', 'LX Factory'],
      },
      { type: 'heading', level: 2, text: 'Food' },
      { type: 'paragraph', text: 'Pastéis de nata everywhere' },
    ]),
    tags: ['Personal'],
    createdAt: daysAgo(30),
    updatedAt: daysAgo(14),
    isFavorite: false,
    isReadOnly: false,
  },
]

export type TagFilterMode = 'AND' | 'OR'
export type NotesSortBy =
  | 'updated-desc'
  | 'created-desc'
  | 'title-asc'
  | 'title-desc'

interface NotesState {
  notes: Note[]
  selectedId: string | null
  searchQuery: string
  activeTags: string[]
  tagFilterMode: TagFilterMode
  untaggedOnly: boolean
  favoritesOnly: boolean
  sortBy: NotesSortBy
  addNote: () => void
  updateNote: (
    id: string,
    patch: Partial<
      Pick<Note, 'title' | 'content' | 'tags' | 'isFavorite' | 'isReadOnly'>
    >,
  ) => void
  deleteNote: (id: string) => void
  selectNote: (id: string) => void
  setSearch: (query: string) => void
  setActiveTags: (tags: string[]) => void
  toggleActiveTag: (tag: string) => void
  setTagFilterMode: (mode: TagFilterMode) => void
  setUntaggedOnly: (value: boolean) => void
  setFavoritesOnly: (value: boolean) => void
  setSortBy: (sort: NotesSortBy) => void
  toggleFavorite: (id: string) => void
  renameTag: (oldTag: string, newTag: string) => void
  deleteTag: (tag: string) => void
}

export const useNotesStore = create<NotesState>()(
  persist(
    (set, get) => ({
      notes: SEED_NOTES,
      selectedId: SEED_NOTES[3]?.id ?? null,
      searchQuery: '',
      activeTags: [],
      tagFilterMode: 'OR',
      untaggedOnly: false,
      favoritesOnly: false,
      sortBy: 'updated-desc',
      addNote: () => {
        const now = new Date().toISOString()
        const id = crypto.randomUUID()
        const note: Note = {
          id,
          title: 'Untitled',
          content: { type: 'doc', content: [{ type: 'paragraph' }] },
          tags: [],
          createdAt: now,
          updatedAt: now,
          isFavorite: false,
          isReadOnly: false,
        }

        set({
          notes: [note, ...get().notes],
          selectedId: id,
        })
      },
      updateNote: (id, patch) =>
        set((state) => ({
          notes: state.notes.map((note) => {
            if (note.id !== id) return note
            const contentChanged =
              patch.content !== undefined &&
              JSON.stringify(patch.content) !== JSON.stringify(note.content)
            const titleChanged =
              patch.title !== undefined && patch.title !== note.title
            return {
              ...note,
              ...patch,
              updatedAt:
                contentChanged || titleChanged
                  ? new Date().toISOString()
                  : note.updatedAt,
            }
          }),
        })),
      deleteNote: (id) =>
        set((state) => {
          const remaining = state.notes.filter((note) => note.id !== id)
          const deletedIndex = state.notes.findIndex((note) => note.id === id)
          let nextSelectedId = state.selectedId

          if (state.selectedId === id) {
            if (remaining.length === 0) {
              nextSelectedId = null
            } else {
              const nextIndex = Math.min(deletedIndex, remaining.length - 1)
              nextSelectedId = remaining[nextIndex]?.id ?? null
            }
          }

          return {
            notes: remaining,
            selectedId: nextSelectedId,
          }
        }),
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
      toggleFavorite: (id) =>
        set((state) => ({
          notes: state.notes.map((note) =>
            note.id === id ? { ...note, isFavorite: !note.isFavorite } : note,
          ),
        })),
      renameTag: (oldTag, newTag) =>
        set((state) => {
          const trimmed = newTag.trim()
          const lowerOld = oldTag.toLowerCase()
          if (!trimmed || trimmed.toLowerCase() === lowerOld) return state
          return {
            notes: state.notes.map((note) => {
              if (!note.tags.some((t) => t.toLowerCase() === lowerOld)) {
                return note
              }
              const seen = new Set<string>()
              const next: string[] = []
              for (const t of note.tags) {
                const replacement = t.toLowerCase() === lowerOld ? trimmed : t
                const key = replacement.toLowerCase()
                if (seen.has(key)) continue
                seen.add(key)
                next.push(replacement)
              }
              return { ...note, tags: next }
            }),
            activeTags: state.activeTags.map((t) =>
              t.toLowerCase() === lowerOld ? trimmed : t,
            ),
          }
        }),
      deleteTag: (tag) =>
        set((state) => ({
          notes: state.notes.map((note) =>
            note.tags.some((t) => t.toLowerCase() === tag.toLowerCase())
              ? {
                  ...note,
                  tags: note.tags.filter(
                    (t) => t.toLowerCase() !== tag.toLowerCase(),
                  ),
                }
              : note,
          ),
          activeTags: state.activeTags.filter(
            (t) => t.toLowerCase() !== tag.toLowerCase(),
          ),
        })),
    }),
    {
      name: 'myspace-notes',
      version: 4,
      migrate: (persistedState, version) => {
        const state = persistedState as Partial<NotesState> & {
          notes?: Note[]
          activeTag?: string | null
        }
        let next: Partial<NotesState> = { ...state }
        if (version < 3 && Array.isArray(state.notes)) {
          next = {
            ...next,
            notes: state.notes.map((note) =>
              normalizeNote(note as Note & { isReadOnly?: boolean }),
            ),
          }
        }
        if (version < 4) {
          const legacyTag = state.activeTag ?? null
          next = {
            ...next,
            activeTags: legacyTag ? [legacyTag] : [],
            tagFilterMode: 'OR',
            untaggedOnly: false,
            favoritesOnly: false,
            sortBy: 'updated-desc',
          }
          delete (next as { activeTag?: unknown }).activeTag
        }
        return next as NotesState
      },
      partialize: (state) => ({
        notes: state.notes,
        sortBy: state.sortBy,
        favoritesOnly: state.favoritesOnly,
      }),
      onRehydrateStorage: () => (state) => {
        if (state && state.notes.length === 0) {
          state.notes = SEED_NOTES
        }
        if (state) {
          state.notes = state.notes.map((note) =>
            normalizeNote(note as Note & { isReadOnly?: boolean }),
          )
        }
        if (state && !state.selectedId && state.notes.length > 0) {
          state.selectedId = state.notes[0]?.id ?? null
        }
      },
    },
  ),
)
