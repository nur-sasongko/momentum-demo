import { useEffect, useRef, useState } from 'react'

import { cn } from '#/libs/utils'

export interface EditableCellOption {
  value: string
  label: string
}

export interface EditableCellRenderInputContext {
  value: string
  onChange: (next: string) => void
  onCommit: () => void
  onCancel: () => void
  className: string
}

interface EditableCellProps {
  value: string
  onSave: (newValue: string) => void | Promise<void>
  /** Custom read-mode display. Defaults to plain value text. */
  display?: React.ReactNode
  /** Input type when editing. Ignored when `options` or `renderInput` is provided. */
  type?: 'text' | 'number' | 'date'
  /** When provided renders a native select instead of a text input. Saves on change. */
  options?: EditableCellOption[]
  /** When provided, replaces the built-in edit-mode input entirely (e.g. for a custom formatted input). Takes priority over `options`/`type`. */
  renderInput?: (ctx: EditableCellRenderInputContext) => React.ReactNode
  placeholder?: string
  className?: string
}

const overlayInputClassName =
  'absolute inset-0 w-full rounded-sm border border-ring bg-background px-1 text-sm outline-none focus:ring-1 focus:ring-ring'

/**
 * Inline editable cell — no layout shift on edit.
 *
 * The display content always stays in the document flow (determining cell
 * size). When editing, an absolutely-positioned input overlays it so the
 * column width never changes.
 *
 * Read mode  → click (or Enter / Space) to edit.
 * Input mode → Enter or blur saves; Escape cancels.
 * Select mode → choosing an option saves immediately; Escape cancels.
 */
export function EditableCell({
  value,
  onSave,
  display,
  type = 'text',
  options,
  renderInput,
  placeholder,
  className,
}: EditableCellProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const inputRef = useRef<HTMLInputElement>(null)
  const selectRef = useRef<HTMLSelectElement>(null)

  // Sync draft when value changes externally (e.g. after a refetch)
  useEffect(() => {
    if (!editing) setDraft(value)
  }, [value, editing])

  // Auto-focus when entering edit mode
  useEffect(() => {
    if (!editing || renderInput) return
    if (options) {
      selectRef.current?.focus()
    } else {
      inputRef.current?.focus()
      inputRef.current?.select()
    }
  }, [editing, options, renderInput])

  const startEdit = () => {
    setDraft(value)
    setEditing(true)
  }

  const commit = () => {
    setEditing(false)
    if (draft !== value) onSave(draft)
  }

  const cancel = () => {
    setDraft(value)
    setEditing(false)
  }

  return (
    <div
      className={cn('group/editable relative rounded', className)}
      onClick={!editing ? startEdit : undefined}
      tabIndex={editing ? -1 : 0}
      onKeyDown={
        !editing
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') startEdit()
            }
          : undefined
      }
    >
      {/* Display: always in layout flow — determines cell width. Hidden during edit. */}
      <div
        className={cn(
          'cursor-text rounded px-1 py-0.5 transition-colors',
          editing
            ? 'invisible select-none'
            : 'group-hover/editable:bg-muted/60',
        )}
      >
        {display ?? (
          <span>
            {value || (
              <span className="text-muted-foreground">
                {placeholder ?? '—'}
              </span>
            )}
          </span>
        )}
      </div>

      {/* Input: absolutely overlays the display so column width never changes */}
      {editing &&
        (renderInput ? (
          renderInput({
            value: draft,
            onChange: setDraft,
            onCommit: commit,
            onCancel: cancel,
            className: overlayInputClassName,
          })
        ) : options ? (
          <select
            ref={selectRef}
            value={draft}
            className={overlayInputClassName}
            onChange={(e) => {
              const next = e.target.value
              setDraft(next)
              setEditing(false)
              if (next !== value) onSave(next)
            }}
            onBlur={() => setEditing(false)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') cancel()
            }}
          >
            {options.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        ) : (
          <input
            ref={inputRef}
            type={type}
            value={draft}
            placeholder={placeholder}
            className={overlayInputClassName}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                commit()
              }
              if (e.key === 'Escape') cancel()
            }}
          />
        ))}
    </div>
  )
}
