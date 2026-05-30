import { generateText } from '@tiptap/core'
import type { JSONContent } from '@tiptap/core'

import { createContentExtensions } from '#/routes/notes/-utils/tiptap-extensions'
import type { Note } from '#/stores/notes-store'

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

export function getAllTags(notes: Note[]): string[] {
  const tags = new Set<string>()
  for (const note of notes) {
    for (const tag of note.tags) {
      tags.add(tag)
    }
  }
  return Array.from(tags).sort((a, b) => a.localeCompare(b))
}

export function filterNotes(
  notes: Note[],
  query: string,
  tag: string | null,
): Note[] {
  const normalizedQuery = query.trim().toLowerCase()

  return notes
    .filter((note) => {
      if (tag && !note.tags.includes(tag)) {
        return false
      }

      if (!normalizedQuery) {
        return true
      }

      const haystack = [
        note.title,
        noteContentToPlainText(note.content),
        ...note.tags,
      ]
        .join(' ')
        .toLowerCase()

      return haystack.includes(normalizedQuery)
    })
    .sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    )
}
