import type { ReactNode } from 'react'

import type { NoteTagCount } from '#/routes/_authenticated/notes/-types/notes-query'

export interface TagPickerProps {
  selected: string[]
  counts: NoteTagCount[]
  onToggle: (tag: string) => void
  allowCreate?: boolean
  onCreate?: (tag: string) => void
  /** Disables the search field and tag list only — `footer` stays interactive. */
  disabled?: boolean
  footer?: ReactNode
}
