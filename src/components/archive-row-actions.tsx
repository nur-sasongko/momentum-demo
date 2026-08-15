import { RotateCcw, Trash2 } from 'lucide-react'
import { useState } from 'react'

import { ConfirmDialog } from '#/components/confirm-dialog'
import { Button } from '#/components/ui/button'

interface ArchiveRowActionsProps {
  /** Shown in the permanent-delete confirmation, quoted. */
  label: string
  onRestore: () => void
  onPurge: () => void
  isRestoring?: boolean
  isPurging?: boolean
}

/**
 * Row actions shared by every archived-item table (the `/archive` route and
 * the in-feature archive views). Restore fires immediately — it's
 * non-destructive and self-evidently reversible. Permanent delete always
 * confirms, since it's the only hard delete left in the app.
 */
export function ArchiveRowActions({
  label,
  onRestore,
  onPurge,
  isRestoring,
  isPurging,
}: ArchiveRowActionsProps) {
  const [confirmOpen, setConfirmOpen] = useState(false)

  return (
    <div className="flex items-center justify-end gap-1">
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={onRestore}
        aria-label="Restore"
        className="text-muted-foreground hover:text-foreground"
        disabled={isRestoring}
      >
        <RotateCcw className="size-3.5" />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={() => setConfirmOpen(true)}
        aria-label="Delete permanently"
        className="text-muted-foreground hover:text-destructive"
        disabled={isPurging}
      >
        <Trash2 className="size-3.5" />
      </Button>
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        onConfirm={() => {
          onPurge()
          setConfirmOpen(false)
        }}
        title="Delete permanently?"
        description={`"${label}" will be permanently deleted. This cannot be undone.`}
        confirmLabel="Delete permanently"
        confirmVariant="destructive"
      />
    </div>
  )
}
