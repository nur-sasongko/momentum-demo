import { z } from 'zod'

export const NOTES_ROUTE_ID = '/_authenticated/notes/' as const

export type TagFilterMode = 'AND' | 'OR'
export type NotesSortBy =
  | 'updated-desc'
  | 'created-desc'
  | 'title-asc'
  | 'title-desc'

/**
 * Normalizes a search value that should be a string array. A bare scalar
 * (produced by a hand-typed URL, e.g. `?tags=a`) is wrapped into a
 * single-element array rather than rejected.
 */
const stringArrayParam = z
  .preprocess((val) => {
    if (val === undefined) return undefined
    return Array.isArray(val) ? val : [val]
  }, z.array(z.string()))
  .catch([])

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
