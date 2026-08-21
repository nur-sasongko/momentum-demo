import { generateText } from '@tiptap/core'
import type { JSONContent } from '@tiptap/core'

import { createContentExtensions } from '#/routes/_authenticated/notes/-utils/tiptap-extensions'

const MAX_TAG_LENGTH = 32

const contentExtensions = createContentExtensions()

export function noteContentToPlainText(content: JSONContent): string {
  return generateText(content, contentExtensions)
}

export function getExcerpt(plainText: string, maxLength = 120): string {
  const plain = plainText.replace(/\s+/g, ' ').trim()

  if (plain.length <= maxLength) {
    return plain
  }
  return `${plain.slice(0, maxLength).trim()}…`
}

export function countWords(plainText: string): number {
  const trimmed = plainText.trim()
  if (!trimmed) return 0
  return trimmed.split(/\s+/).length
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

/**
 * Snaps a newly typed tag to an existing tag's casing when they match
 * case-insensitively, so stored tag values stay canonical even though tag
 * filtering elsewhere is case-insensitive.
 */
export function canonicalizeTag(raw: string, knownTags: string[]): string {
  const normalized = normalizeTag(raw)
  const existing = knownTags.find(
    (tag) => tag.toLowerCase() === normalized.toLowerCase(),
  )
  return existing ?? normalized
}
