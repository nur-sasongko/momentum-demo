import type { JSONContent } from '@tiptap/core'

export const EMPTY_DOC: JSONContent = {
  type: 'doc',
  content: [{ type: 'paragraph' }],
}

function textNode(text: string): JSONContent {
  return { type: 'text', text }
}

function paragraph(text: string): JSONContent {
  return {
    type: 'paragraph',
    content: text ? [textNode(text)] : [],
  }
}

function heading(level: 1 | 2 | 3, text: string): JSONContent {
  return {
    type: 'heading',
    attrs: { level },
    content: [textNode(text)],
  }
}

function bulletList(items: string[]): JSONContent {
  return {
    type: 'bulletList',
    content: items.map((text) => ({
      type: 'listItem',
      content: [paragraph(text)],
    })),
  }
}

function orderedList(items: string[]): JSONContent {
  return {
    type: 'orderedList',
    content: items.map((text) => ({
      type: 'listItem',
      content: [paragraph(text)],
    })),
  }
}

export function doc(...blocks: JSONContent[]): JSONContent {
  return { type: 'doc', content: blocks }
}

export function buildSeedContent(
  blocks: Array<
    | { type: 'heading'; level: 1 | 2 | 3; text: string }
    | { type: 'paragraph'; text: string }
    | { type: 'bulletList'; items: string[] }
    | { type: 'orderedList'; items: string[] }
  >,
): JSONContent {
  const content = blocks.map((block) => {
    switch (block.type) {
      case 'heading':
        return heading(block.level, block.text)
      case 'paragraph':
        return paragraph(block.text)
      case 'bulletList':
        return bulletList(block.items)
      case 'orderedList':
        return orderedList(block.items)
    }
  })

  return doc(...content)
}
