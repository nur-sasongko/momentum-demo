import { useState } from 'react'

/**
 * Guards a close action behind a confirmation when there are unsaved changes.
 *
 * `requestClose` opens the confirm dialog when `isDirty` is true, otherwise
 * calls `onClose` immediately. Pair with `DiscardChangesDialog`
 * (`#/components/discard-changes-dialog`), whose `onDiscard` should call the
 * same `onClose`.
 */
export function useUnsavedChangesGuard(isDirty: boolean, onClose: () => void) {
  const [confirmOpen, setConfirmOpen] = useState(false)

  const requestClose = () => {
    if (isDirty) {
      setConfirmOpen(true)
    } else {
      onClose()
    }
  }

  return { confirmOpen, setConfirmOpen, requestClose }
}
