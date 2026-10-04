import { ListTree, PanelRightClose, PanelRightOpen } from 'lucide-react'
import { useState } from 'react'

import { Button } from '#/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '#/components/ui/popover'
import { TruncatedText } from '#/components/truncated-text'
import { useIsMobile } from '#/hooks/use-mobile'
import { useIsWide } from '#/hooks/use-is-wide'
import { cn } from '#/libs/utils'
import type { OutlineEntry } from '#/routes/_authenticated/notes/-types/notes-outline'
import { useNotesStore } from '#/stores/notes-store'

interface OutlineSelectOptions {
  placeCursor?: boolean
}

// Indexed by nesting depth (level minus the note's shallowest level), so a
// note whose headings start at H2 doesn't open with an empty indent step.
const RAIL_INDENT = ['pl-1.5', 'pl-4', 'pl-6', 'pl-8']
const MOBILE_INDENT = ['pl-2', 'pl-5', 'pl-8', 'pl-11']

function outlineDepths(entries: OutlineEntry[]): number[] {
  const base = Math.min(...entries.map((entry) => entry.level))
  return entries.map((entry) => entry.level - base)
}

interface NoteOutlineProps {
  entries: OutlineEntry[]
  activeIndex: number
  progress: number
  isReadOnly: boolean
  onSelect: (domIndex: number, options?: OutlineSelectOptions) => void
}

function OutlineRow({
  entry,
  depth,
  isActive,
  isPassed,
  isReadOnly,
  onSelect,
}: {
  entry: OutlineEntry
  depth: number
  isActive: boolean
  isPassed: boolean
  isReadOnly: boolean
  onSelect: NoteOutlineProps['onSelect']
}) {
  return (
    <button
      type="button"
      aria-current={isActive ? 'location' : undefined}
      onClick={() => onSelect(entry.domIndex, { placeCursor: !isReadOnly })}
      className={cn(
        'flex h-7 w-full shrink-0 items-center gap-1.5 rounded-sm pr-1.5 text-left transition-colors hover:bg-muted focus-visible:bg-muted',
        RAIL_INDENT[depth],
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          'w-0.5 shrink-0 rounded-full transition-colors',
          depth > 0 ? 'h-3' : 'h-4',
          isPassed ? 'bg-primary' : 'bg-border',
        )}
      />
      <TruncatedText
        className={cn(
          'truncate leading-tight',
          depth > 0 ? 'text-xs' : 'text-[13px]',
          isActive ? 'font-medium text-foreground' : 'text-muted-foreground',
        )}
      >
        {entry.text}
      </TruncatedText>
    </button>
  )
}

/**
 * The heading list shown inside a popover — the mobile button's content, and
 * the `md`–`xl` gutter button's too. Selecting a row scrolls and calls
 * `onDone` so the caller can close the popover.
 */
function OutlinePopoverList({
  entries,
  activeIndex,
  progress,
  isReadOnly,
  onSelect,
  onDone,
}: NoteOutlineProps & { onDone: () => void }) {
  const depths = outlineDepths(entries)

  return (
    <>
      <p className="mb-2 flex items-center justify-between px-2 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
        <span>On this page</span>
        <span className="tabular normal-case">{progress}%</span>
      </p>
      <nav
        aria-label="Note outline"
        className="flex max-h-80 flex-col gap-0.5 overflow-y-auto"
      >
        {entries.map((entry, index) => (
          <button
            key={entry.domIndex}
            type="button"
            aria-current={index === activeIndex ? 'location' : undefined}
            onClick={() => {
              onSelect(entry.domIndex, { placeCursor: !isReadOnly })
              onDone()
            }}
            className={cn(
              'line-clamp-2 shrink-0 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-muted',
              MOBILE_INDENT[depths[index]],
              index === activeIndex
                ? 'font-medium text-foreground'
                : 'text-muted-foreground',
            )}
          >
            {entry.text}
          </button>
        ))}
      </nav>
    </>
  )
}

/**
 * The right-edge outline column. Renders only at `md` and up — mobile gets
 * `NoteOutlineMobileMenu` instead. At `xl` and up it is a labelled panel the
 * user can hide. Otherwise (narrower, hidden by the user, or no headings) it
 * holds a structural `w-6` gutter rather than unmounting, so switching notes
 * never moves the prose column. The gutter holds a single button — "Show
 * outline" at `xl`, an outline popover below it — or, with no headings, just a
 * margin rule. Nothing expands on hover. See `024`'s 2026-10-04 amendment.
 */
export function NoteOutline({
  entries,
  activeIndex,
  progress,
  isReadOnly,
  onSelect,
}: NoteOutlineProps) {
  const isMobile = useIsMobile()
  const isWide = useIsWide()
  const isOutlineCollapsed = useNotesStore((s) => s.isOutlineCollapsed)
  const setOutlineCollapsed = useNotesStore((s) => s.setOutlineCollapsed)
  const [popoverOpen, setPopoverOpen] = useState(false)

  if (isMobile) return null

  const hasEntries = entries.length > 0

  if (!hasEntries) {
    return (
      <aside className="relative w-6 shrink-0">
        <span
          aria-hidden="true"
          className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-border"
        />
      </aside>
    )
  }

  if (isWide && !isOutlineCollapsed) {
    const depths = outlineDepths(entries)

    return (
      <aside className="relative w-56 shrink-0 border-l border-border">
        <div className="flex h-full flex-col py-3">
          <div className="mb-2 flex shrink-0 items-center justify-between gap-2 px-2">
            <span className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
              On this page
            </span>
            <div className="flex shrink-0 items-center gap-1">
              <span className="tabular text-xs text-muted-foreground">
                {progress}%
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-expanded
                aria-label="Hide outline"
                onClick={() => setOutlineCollapsed(true)}
                className="text-muted-foreground"
              >
                <PanelRightClose className="size-3.5" />
              </Button>
            </div>
          </div>
          <nav
            aria-label="Note outline"
            className="flex flex-1 flex-col overflow-x-hidden overflow-y-auto px-1"
          >
            {entries.map((entry, index) => (
              <OutlineRow
                key={entry.domIndex}
                entry={entry}
                depth={depths[index]}
                isActive={index === activeIndex}
                isPassed={index <= activeIndex}
                isReadOnly={isReadOnly}
                onSelect={onSelect}
              />
            ))}
          </nav>
        </div>
      </aside>
    )
  }

  return (
    <aside className="relative w-6 shrink-0">
      <div className="absolute top-3 right-0 flex size-6 items-center justify-center">
        {isWide ? (
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            aria-expanded={false}
            aria-label="Show outline"
            onClick={() => setOutlineCollapsed(false)}
            className="text-muted-foreground"
          >
            <PanelRightOpen className="size-3" />
          </Button>
        ) : (
          <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                aria-label="Outline"
                className="text-muted-foreground"
              >
                <ListTree className="size-3" />
              </Button>
            </PopoverTrigger>
            <PopoverContent
              side="bottom"
              align="end"
              className="w-64 p-2"
              data-note-editor-portal=""
            >
              <OutlinePopoverList
                entries={entries}
                activeIndex={activeIndex}
                progress={progress}
                isReadOnly={isReadOnly}
                onSelect={onSelect}
                onDone={() => setPopoverOpen(false)}
              />
            </PopoverContent>
          </Popover>
        )}
      </div>
    </aside>
  )
}

interface NoteOutlineMobileMenuProps extends Pick<
  NoteOutlineProps,
  'entries' | 'activeIndex' | 'isReadOnly' | 'onSelect'
> {
  progress: number
  /** Lifts the button from `bottom-6` to `bottom-24` while the save bar shows. */
  isRaised: boolean
}

/**
 * Floating-action-button entry point for narrow viewports, where the rail's
 * 224px column has nowhere to go. Deliberately not a header icon — see
 * "The mobile trigger is a floating action button, not a header icon" in
 * `202608200500-notes-outline-headings.md#spec-202608200500`: a control whose entire job is mid-read
 * navigation belongs in thumb reach, not the top corner. Geometry matches
 * `task-add-fab.tsx` so it reads as the app's one floating-button convention.
 */
export function NoteOutlineMobileMenu({
  entries,
  activeIndex,
  isReadOnly,
  onSelect,
  progress,
  isRaised,
}: NoteOutlineMobileMenuProps) {
  const isMobile = useIsMobile()
  const [open, setOpen] = useState(false)

  if (!isMobile || entries.length === 0) return null

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          className={cn(
            'fixed right-6 z-40 h-14 w-14 rounded-full p-0 shadow-lg transition-[bottom]',
            isRaised ? 'bottom-24' : 'bottom-6',
          )}
          aria-label="Outline"
        >
          <ListTree className="size-6" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="end"
        className="w-64 p-2"
        data-note-editor-portal=""
      >
        <OutlinePopoverList
          entries={entries}
          activeIndex={activeIndex}
          progress={progress}
          isReadOnly={isReadOnly}
          onSelect={onSelect}
          onDone={() => setOpen(false)}
        />
      </PopoverContent>
    </Popover>
  )
}
