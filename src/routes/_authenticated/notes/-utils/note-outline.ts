import type { JSONContent } from '@tiptap/core'

import type { OutlineEntry } from '#/routes/_authenticated/notes/-types/notes-outline'

function clampLevel(level: unknown): 1 | 2 | 3 {
  const numeric = typeof level === 'number' ? level : 1
  if (numeric <= 1) return 1
  if (numeric === 2) return 2
  return 3
}

function collectText(node: JSONContent): string {
  if (node.text) return node.text
  if (!node.content) return ''
  return node.content.map(collectText).join('')
}

/**
 * Walks the note's ProseMirror JSON depth-first and assigns each heading a
 * `domIndex` counting every heading encountered (empty ones included), so it
 * stays aligned with `querySelectorAll('h1,h2,h3,h4,h5,h6')` on the rendered
 * editor DOM — see spec 024 for why the outline can't carry its own heading
 * IDs.
 */
export function extractOutline(content: JSONContent): OutlineEntry[] {
  const entries: OutlineEntry[] = []
  let domIndex = -1

  function walk(node: JSONContent) {
    if (node.type === 'heading') {
      domIndex += 1
      const text = collectText(node).trim()
      if (text) {
        entries.push({ level: clampLevel(node.attrs?.level), text, domIndex })
      }
    }
    node.content?.forEach(walk)
  }

  walk(content)
  return entries
}
