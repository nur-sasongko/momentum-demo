import { Loader2 } from 'lucide-react'

import { Button } from '#/components/ui/button'
import { cn } from '#/libs/utils'

export const SAVE_SHORTCUT_LABEL =
  typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)
    ? '⌘S'
    : 'Ctrl+S'

interface UnsavedChangesBarProps {
  state: 'dirty' | 'saving'
  onSave: () => void
}

export function UnsavedChangesBar({ state, onSave }: UnsavedChangesBarProps) {
  const isSaving = state === 'saving'

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'absolute bottom-4 left-1/2 z-20 flex max-w-[calc(100%-2rem)] -translate-x-1/2 items-center gap-3 rounded-full border border-border bg-popover px-4 py-2 text-sm text-popover-foreground shadow-lg',
        'animate-in fade-in slide-in-from-bottom-2',
      )}
    >
      {isSaving ? (
        <Loader2 className="size-3.5 shrink-0 animate-spin text-muted-foreground" />
      ) : (
        <span
          className="size-2 shrink-0 rounded-full bg-amber-500"
          aria-hidden="true"
        />
      )}
      <span className="whitespace-nowrap">
        {isSaving ? 'Saving…' : 'Unsaved changes'}
      </span>
      <span className="hidden shrink-0 text-xs text-muted-foreground sm:inline">
        {SAVE_SHORTCUT_LABEL}
      </span>
      <Button size="sm" onClick={onSave} disabled={isSaving}>
        Save
      </Button>
    </div>
  )
}
