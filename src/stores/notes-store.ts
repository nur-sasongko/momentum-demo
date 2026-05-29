import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface Note {
  id: string
  title: string
  body: string
  tags: string[]
  createdAt: string
  updatedAt: string
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
    body: `# Welcome to MySpace

Your personal space for notes, habits, and finance — all in one place.

## Getting started

- Capture ideas in Second Brain
- Track daily habits
- Plan your finances`,
    tags: ['Personal'],
    createdAt: daysAgo(14),
    updatedAt: daysAgo(0, 20),
  },
  {
    id: 'note-deep-work',
    title: 'Book: Deep Work',
    body: `# Deep Work — Cal Newport

Key ideas to revisit:

- Focus blocks without distraction
- Shallow work batching
- Rituals for deep sessions`,
    tags: ['Reading', 'Ideas'],
    createdAt: daysAgo(10),
    updatedAt: daysAgo(1),
  },
  {
    id: 'note-q3-planning',
    title: 'Q3 Planning',
    body: `## Goals

- Ship habits module polish
- Second Brain MVP
- Finance tracker v1

## Open questions

- Mobile layout priorities
- Sync strategy later`,
    tags: ['Work'],
    createdAt: daysAgo(8),
    updatedAt: daysAgo(2),
  },
  {
    id: 'note-ideas-backlog',
    title: 'Ideas backlog',
    body: `## Things to explore

- A daily review template
- Weekly finance check-in
- Habit "missed day" recovery flow`,
    tags: ['Ideas'],
    createdAt: daysAgo(12),
    updatedAt: daysAgo(4),
  },
  {
    id: 'note-miso-pasta',
    title: 'Recipe — Miso pasta',
    body: `## Ingredients

- Pasta, miso paste, butter, garlic, parmesan

## Steps

1. Cook pasta al dente
2. Sauté garlic in butter
3. Whisk miso with pasta water
4. Toss and finish with parmesan`,
    tags: ['Personal'],
    createdAt: daysAgo(20),
    updatedAt: daysAgo(6),
  },
  {
    id: 'note-design-sync',
    title: 'Meeting notes — Design sync',
    body: `## Attendees

Design + eng

## Decisions

- Split view for notes
- Tag chips above list
- Preview toggle in editor toolbar`,
    tags: ['Work'],
    createdAt: daysAgo(15),
    updatedAt: daysAgo(8),
  },
  {
    id: 'note-slow-productivity',
    title: 'Article — On slow productivity',
    body: `Takeaways:

- Fewer priorities, deeper work
- Protect mornings for creative tasks
- Batch admin in afternoon blocks`,
    tags: ['Reading'],
    createdAt: daysAgo(18),
    updatedAt: daysAgo(11),
  },
  {
    id: 'note-lisbon',
    title: 'Travel — Lisbon shortlist',
    body: `## Places

- Alfama walk
- Time Out Market
- LX Factory

## Food

- Pastéis de nata everywhere`,
    tags: ['Personal'],
    createdAt: daysAgo(30),
    updatedAt: daysAgo(14),
  },
]

interface NotesState {
  notes: Note[]
  selectedId: string | null
  searchQuery: string
  activeTag: string | null
  isPreview: boolean
  addNote: () => void
  updateNote: (id: string, patch: Partial<Pick<Note, 'title' | 'body' | 'tags'>>) => void
  deleteNote: (id: string) => void
  selectNote: (id: string) => void
  setSearch: (query: string) => void
  setActiveTag: (tag: string | null) => void
  togglePreview: () => void
}

export const useNotesStore = create<NotesState>()(
  persist(
    (set, get) => ({
      notes: SEED_NOTES,
      selectedId: SEED_NOTES[3]?.id ?? null,
      searchQuery: '',
      activeTag: null,
      isPreview: false,
      addNote: () => {
        const now = new Date().toISOString()
        const id = crypto.randomUUID()
        const note: Note = {
          id,
          title: 'Untitled',
          body: '',
          tags: [],
          createdAt: now,
          updatedAt: now,
        }

        set({
          notes: [note, ...get().notes],
          selectedId: id,
          isPreview: false,
        })
      },
      updateNote: (id, patch) =>
        set((state) => ({
          notes: state.notes.map((note) =>
            note.id === id
              ? {
                  ...note,
                  ...patch,
                  updatedAt: new Date().toISOString(),
                }
              : note,
          ),
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
      selectNote: (id) => set({ selectedId: id, isPreview: false }),
      setSearch: (query) => set({ searchQuery: query }),
      setActiveTag: (tag) => set({ activeTag: tag }),
      togglePreview: () => set((state) => ({ isPreview: !state.isPreview })),
    }),
    {
      name: 'myspace-notes',
      version: 1,
      partialize: (state) => ({ notes: state.notes }),
      onRehydrateStorage: () => (state) => {
        if (state && state.notes.length === 0) {
          state.notes = SEED_NOTES
        }
        if (state && !state.selectedId && state.notes.length > 0) {
          state.selectedId = state.notes[0]?.id ?? null
        }
      },
    },
  ),
)
