import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '#/components/ui/sheet'
import { useIsMobile } from '#/hooks/use-mobile'
import { cn } from '#/libs/utils'
import { ArchivedNotesTable } from './archived-notes-table'

interface ArchivedNotesSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * Side panel over the note list — see docs/specs/023-core-in-feature-archive-views.md
 * decision 5. Mounts the same table as `/archive`'s Second Brain tab verbatim.
 */
export function ArchivedNotesSheet({
  open,
  onOpenChange,
}: ArchivedNotesSheetProps) {
  const isMobile = useIsMobile()

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={isMobile ? 'bottom' : 'right'}
        className={cn(
          'flex flex-col gap-4',
          isMobile ? 'h-[85dvh] rounded-t-xl' : 'sm:max-w-3xl',
        )}
      >
        <SheetHeader>
          <SheetTitle>Archived notes</SheetTitle>
          <SheetDescription>
            Kept for 30 days, then permanently removed.
          </SheetDescription>
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
          <ArchivedNotesTable />
        </div>
      </SheetContent>
    </Sheet>
  )
}
