import type { JSONContent } from '@tiptap/core'

// Supabase response row — snake_case, mirrors the `notes` table columns
// exactly (see supabase/migrations/20260808000001_create_notes.sql).
// `transformNote`/`transformNoteSummary` in `-utils/notes-queries.ts` map
// this onto the camelCase `Note`/`NoteSummary` domain types in
// `#/stores/notes-store`.
export interface NoteRow {
  id: string
  user_id: string
  title: string
  content: JSONContent
  plain_text: string
  excerpt: string
  /** Postgres `tsvector`, serialized to text. Never read by the app. */
  search_vector: string
  tags: string[]
  is_favorite: boolean
  is_read_only: boolean
  created_at: string
  updated_at: string
}

/** The columns selected by the list/link-target queries — everything except the body. */
export type NoteSummaryRow = Pick<
  NoteRow,
  | 'id'
  | 'title'
  | 'excerpt'
  | 'tags'
  | 'is_favorite'
  | 'is_read_only'
  | 'created_at'
  | 'updated_at'
>
