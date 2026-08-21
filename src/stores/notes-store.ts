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

interface NotesState {
  linkTargets: NoteSummary[]
  setLinkTargets: (targets: NoteSummary[]) => void

  isOutlineCollapsed: boolean
  setOutlineCollapsed: (collapsed: boolean) => void
}

export const useNotesStore = create<NotesState>()(
  persist(
    (set) => ({
      linkTargets: [],
      setLinkTargets: (targets) => set({ linkTargets: targets }),

      isOutlineCollapsed: false,
      setOutlineCollapsed: (collapsed) =>
        set({ isOutlineCollapsed: collapsed }),
    }),
    {
      name: 'momentum-notes',
      version: 1,
      partialize: (state) => ({
        isOutlineCollapsed: state.isOutlineCollapsed,
      }),
    },
  ),
)
