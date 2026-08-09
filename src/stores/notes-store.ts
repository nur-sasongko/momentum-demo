import type { JSONContent } from '@tiptap/core'
import { create } from 'zustand'

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
}

export const useNotesStore = create<NotesState>()((set) => ({
  linkTargets: [],
  setLinkTargets: (targets) => set({ linkTargets: targets }),
}))
