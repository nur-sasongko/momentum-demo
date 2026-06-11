import { generateText } from '@tiptap/core'
import type { JSONContent } from '@tiptap/core'

import { createContentExtensions } from '#/routes/notes/-utils/tiptap-extensions'
import type { Note, NotesSortBy, TagFilterMode } from '#/stores/notes-store'

const MAX_TAG_LENGTH = 32

const contentExtensions = createContentExtensions()

export function formatRelativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const diffMinutes = Math.floor(diffMs / 60000)

  if (diffMinutes < 1) {
    return 'just now'
  }
  if (diffMinutes < 60) {
    return diffMinutes === 1 ? '1 minute' : `${diffMinutes} minutes`
  }

  const diffHours = Math.floor(diffMinutes / 60)
  if (diffHours < 24) {
    return diffHours === 1 ? '1 hour' : `${diffHours} hours`
  }

  const diffDays = Math.floor(diffHours / 24)
  if (diffDays === 1) {
    return '1 day'
  }
  return `${diffDays} days`
}

export function noteContentToPlainText(content: JSONContent): string {
  return generateText(content, contentExtensions)
}

export function getExcerpt(content: JSONContent, maxLength = 120): string {
  const plain = noteContentToPlainText(content).replace(/\s+/g, ' ').trim()

  if (plain.length <= maxLength) {
    return plain
  }
  return `${plain.slice(0, maxLength).trim()}…`
}

export function isEmptyDoc(content: JSONContent): boolean {
  const nodes = content.content ?? []
  if (nodes.length === 0) return true
  if (nodes.length === 1 && nodes[0].type === 'paragraph') {
    const children = nodes[0].content ?? []
    return (
      children.length === 0 ||
      children.every((n) => n.type === 'text' && !n.text?.trim())
    )
  }
  return false
}

export function getAllTags(notes: Note[]): string[] {
  const tags = new Set<string>()
  for (const note of notes) {
    for (const tag of note.tags) {
      tags.add(tag)
    }
  }
  return Array.from(tags).sort((a, b) => a.localeCompare(b))
}

export function normalizeTag(raw: string): string {
  return raw
    .replace(/^#+/, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_TAG_LENGTH)
}

export function addTagsCaseInsensitive(
  existing: string[],
  candidate: string,
): string[] {
  const lower = candidate.toLowerCase()
  if (existing.some((t) => t.toLowerCase() === lower)) {
    return existing
  }
  return [...existing, candidate]
}

export interface NotesFilterOptions {
  query: string
  activeTags: string[]
  tagFilterMode: TagFilterMode
  untaggedOnly: boolean
  favoritesOnly: boolean
  sortBy: NotesSortBy
}

function compareSort(a: Note, b: Note, sortBy: NotesSortBy): number {
  switch (sortBy) {
    case 'updated-desc':
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    case 'created-desc':
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    case 'title-asc':
      return (a.title || 'Untitled').localeCompare(b.title || 'Untitled')
    case 'title-desc':
      return (b.title || 'Untitled').localeCompare(a.title || 'Untitled')
  }
}

export function filterNotes(
  notes: Note[],
  options: NotesFilterOptions,
): Note[] {
  const {
    query,
    activeTags,
    tagFilterMode,
    untaggedOnly,
    favoritesOnly,
    sortBy,
  } = options
  const normalizedQuery = query.trim().toLowerCase()
  const lowerActiveTags = activeTags.map((t) => t.toLowerCase())

  return notes
    .filter((note) => {
      if (favoritesOnly && !note.isFavorite) return false

      if (untaggedOnly) {
        if (note.tags.length > 0) return false
      } else if (lowerActiveTags.length > 0) {
        const lowerNoteTags = note.tags.map((t) => t.toLowerCase())
        const matches =
          tagFilterMode === 'AND'
            ? lowerActiveTags.every((t) => lowerNoteTags.includes(t))
            : lowerActiveTags.some((t) => lowerNoteTags.includes(t))
        if (!matches) return false
      }

      if (!normalizedQuery) return true

      const haystack = [
        note.title,
        noteContentToPlainText(note.content),
        ...note.tags,
      ]
        .join(' ')
        .toLowerCase()

      return haystack.includes(normalizedQuery)
    })
    .sort((a, b) => compareSort(a, b, sortBy))
}
