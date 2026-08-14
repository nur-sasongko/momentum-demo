import { z } from 'zod'

import { stringArrayParam } from '#/utils/search-params'

export const NOTES_ROUTE_ID = '/_authenticated/notes/' as const

export type TagFilterMode = 'AND' | 'OR'
export type NotesSortBy =
  | 'updated-desc'
  | 'created-desc'
  | 'title-asc'
  | 'title-desc'

export const notesSearchSchema = z.object({
  /** Opened note id. */
  note: z.string().optional().catch(undefined),
  /** Search text. */
  q: z.string().catch(''),
  /** Active tag filters. */
  tags: stringArrayParam,
  tagMode: z.enum(['AND', 'OR']).catch('OR'),
  untagged: z.boolean().catch(false),
  fav: z.boolean().catch(false),
  sort: z
    .enum(['updated-desc', 'created-desc', 'title-asc', 'title-desc'])
    .catch('updated-desc'),
})

export type NotesSearch = z.infer<typeof notesSearchSchema>

export const NOTES_SEARCH_DEFAULTS: NotesSearch = {
  note: undefined,
  q: '',
  tags: [],
  tagMode: 'OR',
  untagged: false,
  fav: false,
  sort: 'updated-desc',
}
