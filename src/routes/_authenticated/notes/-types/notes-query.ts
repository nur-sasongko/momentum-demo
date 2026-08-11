import type { NoteSummary } from '#/stores/notes-store'

/**
 * `tagFilterMode` and `sortBy` are inlined rather than importing
 * `TagFilterMode`/`NotesSortBy` from `../-utils/notes-route-search`:
 * `-types/` stays one-way-dependent on `#/stores/`, never on `-utils/`.
 */
export interface NotesListParams {
  search: string | null
  /** Pre-sorted — this is part of the cache key. */
  activeTags: string[]
  tagFilterMode: 'AND' | 'OR'
  untaggedOnly: boolean
  favoritesOnly: boolean
  sortBy: 'updated-desc' | 'created-desc' | 'title-asc' | 'title-desc'
}

export type NotesTagFilter =
  | { kind: 'none' }
  | { kind: 'untagged' }
  | { kind: 'overlaps'; tags: string[] }
  | { kind: 'contains'; tags: string[] }

export interface NotesOrder {
  column: 'updated_at' | 'created_at' | 'title'
  ascending: boolean
}

export interface NotesListQueryDescriptor {
  tagFilter: NotesTagFilter
  order: NotesOrder[]
}

export interface NotesListPage {
  data: NoteSummary[]
}

export interface NoteTagCount {
  tag: string
  noteCount: number
}
