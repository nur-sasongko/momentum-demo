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

interface NoteOutlineProps {
  entries: OutlineEntry[]
  activeIndex: number
  progress: number
  isReadOnly: boolean
  onSelect: (domIndex: number, options?: OutlineSelectOptions) => void
}

function OutlineRow({
  entry,
  isActive,
  isPassed,
  isReadOnly,
  collapsed,
  onSelect,
}: {
  entry: OutlineEntry
  isActive: boolean
  isPassed: boolean
  isReadOnly: boolean
  collapsed: boolean
  onSelect: NoteOutlineProps['onSelect']
}) {
  return (
    <button
      type="button"
      aria-current={isActive ? 'location' : undefined}
      onClick={() => onSelect(entry.domIndex, { placeCursor: !isReadOnly })}
      className={cn(
        'flex h-7 w-full shrink-0 items-center gap-1.5 rounded-sm px-1.5 text-left transition-colors hover:bg-muted focus-visible:bg-muted',
        entry.level === 3 && 'pl-4',
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          'w-0.5 shrink-0 rounded-full transition-colors',
          entry.level === 3 ? 'h-3' : 'h-4',
          isPassed ? 'bg-primary' : 'bg-border',
        )}
      />
      <TruncatedText
        className={cn(
          'truncate leading-tight',
          entry.level === 3 ? 'text-xs' : 'text-[13px]',
          isActive ? 'font-medium text-foreground' : 'text-muted-foreground',
          collapsed &&
            'opacity-0 transition-opacity duration-150 group-hover/outline:opacity-100 group-focus-within/outline:opacity-100',
        )}
      >
        {entry.text}
      </TruncatedText>
    </button>
  )
}

/**
 * The right-edge outline column. Renders only at `md` and up — mobile gets
 * `NoteOutlineMobileMenu` instead, since a 224px column has no room on a
 * phone screen. Below `xl` (and whenever the user collapses it manually, or
 * whenever the note has no headings) it holds a structural `w-6` gutter
 * rather than unmounting, so switching notes never moves the prose column —
 * see `024`'s 2026-08-21 amendment. The gutter itself carries a centred
 * hairline that reads as a notebook margin rule when there is nothing else
 * to show, and expands over the prose on hover or `:focus-within`, entirely
 * via CSS — no extra JS state for the reveal.
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

  if (isMobile) return null

  const hasEntries = entries.length > 0
  const collapsed = !isWide || isOutlineCollapsed || !hasEntries
  const canToggle = isWide && hasEntries

  return (
    <aside
      className={cn(
        'group/outline relative shrink-0',
        collapsed ? 'w-6' : 'w-56 border-l border-border',
      )}
    >
      {collapsed ? (
        <span
          aria-hidden="true"
          className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-border"
        />
      ) : null}

      <div
        className={cn(
          'flex h-full flex-col py-3',
          collapsed &&
            'absolute inset-y-0 right-0 z-10 w-6 overflow-hidden transition-[width,box-shadow,background-color] duration-150 group-hover/outline:w-56 group-hover/outline:overflow-visible group-hover/outline:rounded-l-md group-hover/outline:border group-hover/outline:border-border group-hover/outline:bg-popover group-hover/outline:shadow-md group-focus-within/outline:w-56 group-focus-within/outline:overflow-visible group-focus-within/outline:rounded-l-md group-focus-within/outline:border group-focus-within/outline:border-border group-focus-within/outline:bg-popover group-focus-within/outline:shadow-md',
        )}
      >
        {hasEntries ? (
          <div
            className={cn(
              'mb-2 flex shrink-0 items-center justify-between gap-2 px-2',
              collapsed &&
                'pointer-events-none opacity-0 transition-opacity duration-150 group-hover/outline:pointer-events-auto group-hover/outline:opacity-100 group-focus-within/outline:pointer-events-auto group-focus-within/outline:opacity-100',
            )}
          >
            <span className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
              On this page
            </span>
            <div className="flex shrink-0 items-center gap-1">
              <span className="tabular text-xs text-muted-foreground">
                {progress}%
              </span>
              {!collapsed ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-expanded={!isOutlineCollapsed}
                  aria-label="Hide outline"
                  onClick={() => setOutlineCollapsed(true)}
                  className="text-muted-foreground"
                >
                  <PanelRightClose className="size-3.5" />
                </Button>
              ) : null}
            </div>
          </div>
        ) : null}

        {hasEntries ? (
          <nav
            aria-label="Note outline"
            className="flex flex-1 flex-col overflow-x-hidden overflow-y-auto px-1"
          >
            {entries.map((entry, index) => (
              <OutlineRow
                key={entry.domIndex}
                entry={entry}
                isActive={index === activeIndex}
                isPassed={index <= activeIndex}
                isReadOnly={isReadOnly}
                collapsed={collapsed}
                onSelect={onSelect}
              />
            ))}
          </nav>
        ) : null}
      </div>

      {collapsed && hasEntries ? (
        <div className="absolute top-3 right-0 z-20 flex size-6 items-center justify-center">
          {canToggle ? (
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              aria-expanded={!isOutlineCollapsed}
              aria-label={isOutlineCollapsed ? 'Show outline' : 'Hide outline'}
              onClick={() => setOutlineCollapsed(!isOutlineCollapsed)}
              className="text-muted-foreground"
            >
              {isOutlineCollapsed ? (
                <PanelRightOpen className="size-3" />
              ) : (
                <PanelRightClose className="size-3" />
              )}
            </Button>
          ) : (
            <ListTree
              aria-hidden="true"
              className="size-3 text-muted-foreground"
            />
          )}
        </div>
      ) : null}
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
 * `024-notes-table-of-contents.md`: a control whose entire job is mid-read
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
                setOpen(false)
              }}
              className={cn(
                'line-clamp-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-muted',
                entry.level === 3 && 'pl-5',
                index === activeIndex
                  ? 'font-medium text-foreground'
                  : 'text-muted-foreground',
              )}
            >
              {entry.text}
            </button>
          ))}
        </nav>
      </PopoverContent>
    </Popover>
  )
}
