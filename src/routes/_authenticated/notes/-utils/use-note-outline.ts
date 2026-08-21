import type { Editor } from '@tiptap/core'
import type { RefObject } from 'react'
import { useCallback, useEffect, useRef, useState } from 'react'

import type { OutlineEntry } from '#/routes/_authenticated/notes/-types/notes-outline'

const ACTIVE_THRESHOLD_PX = 96
const SCROLL_MARGIN_PX = 24

interface NoteOutlineResult {
  activeIndex: number
  progress: number
  scrollTo: (domIndex: number, options?: { placeCursor?: boolean }) => void
}

function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

// Typed as possibly-`undefined` per element (unlike the array's own real
// type) so indexing past the end — the mismatch edge case in spec 024 — is
// caught by the type checker instead of relying on runtime luck.
function getHeadingElements(editor: Editor): Array<HTMLElement | undefined> {
  return Array.from(
    editor.view.dom.querySelectorAll<HTMLElement>('h1, h2, h3, h4, h5, h6'),
  )
}

// ProseMirror document positions of every heading node, in the same
// depth-first document order as `extractOutline`'s `domIndex` — used to map
// the current selection back to an entry, independent of scroll position.
function getHeadingPositions(editor: Editor): number[] {
  const positions: number[] = []
  editor.state.doc.descendants((node, pos) => {
    if (node.type.name === 'heading') positions.push(pos)
  })
  return positions
}

/**
 * Measures heading positions inside the pane's own scroll container (never
 * `window` — see spec 024) to drive scroll-spy and reading progress for the
 * outline rail. Rows themselves are fixed-height — see the 2026-08-20
 * amendment in spec 024 for why proportional row heights were dropped.
 */
export function useNoteOutline(
  entries: OutlineEntry[],
  scrollRef: RefObject<HTMLElement | null>,
  editor: Editor | null,
): NoteOutlineResult {
  const [offsets, setOffsets] = useState<Array<number | null>>([])
  const [activeIndex, setActiveIndex] = useState(0)
  const [progress, setProgress] = useState(0)
  const rafRef = useRef<number | null>(null)

  const measure = useCallback(() => {
    const container = scrollRef.current
    if (!container || !editor) {
      setOffsets([])
      return
    }

    const headingEls = getHeadingElements(editor)
    const containerRect = container.getBoundingClientRect()
    const scrollTop = container.scrollTop

    setOffsets(
      entries.map((entry) => {
        const el = headingEls[entry.domIndex]
        return el
          ? el.getBoundingClientRect().top - containerRect.top + scrollTop
          : null
      }),
    )
  }, [entries, editor, scrollRef])

  const updateScrollState = useCallback(() => {
    const container = scrollRef.current
    if (!container) return

    const scrollTop = container.scrollTop
    const threshold = scrollTop + ACTIVE_THRESHOLD_PX
    let next = 0
    for (let i = 0; i < offsets.length; i += 1) {
      const offset = offsets[i]
      if (offset !== null && offset <= threshold) next = i
    }
    setActiveIndex(next)

    const maxScroll = container.scrollHeight - container.clientHeight
    setProgress(
      maxScroll <= 0
        ? 100
        : Math.round(Math.min(1, Math.max(0, scrollTop / maxScroll)) * 100),
    )
  }, [offsets, scrollRef])

  useEffect(measure, [measure])
  useEffect(updateScrollState, [updateScrollState])

  useEffect(() => {
    if (!editor) return
    const observer = new ResizeObserver(() => measure())
    observer.observe(editor.view.dom)
    return () => observer.disconnect()
  }, [editor, measure])

  // Scroll position alone can't tell "which heading is active" when the
  // note fits on screen without scrolling — `scrollTop` never leaves 0, so
  // `updateScrollState` above never has a signal to react to. Clicking (or
  // arrow-keying) into a section moves the selection even when nothing
  // scrolls, so track that too: whichever heading's document position is
  // the last one at or before the cursor is the active entry.
  useEffect(() => {
    if (!editor) return

    const updateActiveFromSelection = () => {
      if (entries.length === 0) return

      const headingPositions = getHeadingPositions(editor)
      const selectionPos = editor.state.selection.from
      let next = 0
      for (let i = 0; i < entries.length; i += 1) {
        const pos = headingPositions[entries[i].domIndex]
        if (typeof pos === 'number' && pos <= selectionPos) next = i
      }
      setActiveIndex(next)
    }

    editor.on('selectionUpdate', updateActiveFromSelection)
    return () => {
      editor.off('selectionUpdate', updateActiveFromSelection)
    }
  }, [editor, entries])

  useEffect(() => {
    const container = scrollRef.current
    if (!container) return

    const onScroll = () => {
      if (rafRef.current !== null) return
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null
        updateScrollState()
      })
    }

    container.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      container.removeEventListener('scroll', onScroll)
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    }
  }, [scrollRef, updateScrollState])

  const scrollTo = useCallback(
    (domIndex: number, options?: { placeCursor?: boolean }) => {
      const container = scrollRef.current
      if (!container || !editor) return

      const el = getHeadingElements(editor)[domIndex]
      if (!el) return

      const containerRect = container.getBoundingClientRect()
      const target =
        el.getBoundingClientRect().top -
        containerRect.top +
        container.scrollTop -
        SCROLL_MARGIN_PX

      container.scrollTo({
        top: Math.max(target, 0),
        behavior: prefersReducedMotion() ? 'auto' : 'smooth',
      })

      if (options?.placeCursor && editor.isEditable) {
        const pos = editor.view.posAtDOM(el, 0)
        editor.chain().focus().setTextSelection(pos).run()
      }
    },
    [editor, scrollRef],
  )

  return { activeIndex, progress, scrollTo }
}
