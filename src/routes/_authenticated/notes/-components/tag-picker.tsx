import { Search } from 'lucide-react'
import { useState } from 'react'

import { TruncatedText } from '#/components/truncated-text'
import { Checkbox } from '#/components/ui/checkbox'
import { Input } from '#/components/ui/input'
import { cn } from '#/libs/utils'
import { canonicalizeTag } from '#/routes/_authenticated/notes/-utils/notes-utils'
import type { TagPickerProps } from '#/routes/_authenticated/notes/-types/notes-tags'

export function TagPicker({
  selected,
  counts,
  onToggle,
  allowCreate = false,
  onCreate,
  disabled = false,
  footer,
}: TagPickerProps) {
  const [query, setQuery] = useState('')

  const normalizedQuery = query.trim().toLowerCase()
  const filtered = normalizedQuery
    ? counts.filter((c) => c.tag.toLowerCase().includes(normalizedQuery))
    : counts

  const hasExactMatch = counts.some(
    (c) => c.tag.toLowerCase() === normalizedQuery,
  )
  const showCreate = allowCreate && normalizedQuery !== '' && !hasExactMatch

  const handleCreate = () => {
    const tag = canonicalizeTag(
      query,
      counts.map((c) => c.tag),
    )
    if (!tag) return
    onCreate?.(tag)
    setQuery('')
  }

  return (
    <div className="flex flex-col gap-2">
      <div
        className={cn(
          'flex flex-col gap-2',
          disabled && 'pointer-events-none opacity-50',
        )}
        aria-disabled={disabled}
      >
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Find a tag…"
            className="h-8 pl-8 text-sm"
            aria-label="Find a tag"
            disabled={disabled}
          />
        </div>

        <div className="max-h-64 overflow-y-auto">
          {counts.length === 0 ? (
            <p className="px-2 py-4 text-center text-xs text-muted-foreground">
              No tags yet
            </p>
          ) : (
            <ul className="flex flex-col">
              {filtered.map(({ tag, noteCount }) => {
                const isChecked = selected.some(
                  (t) => t.toLowerCase() === tag.toLowerCase(),
                )
                return (
                  <li key={tag}>
                    <label className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent">
                      <Checkbox
                        checked={isChecked}
                        onCheckedChange={() => onToggle(tag)}
                      />
                      <TruncatedText className="min-w-0 flex-1 truncate">
                        {tag}
                      </TruncatedText>
                      <span className="tabular shrink-0 text-xs text-muted-foreground">
                        {noteCount}
                      </span>
                    </label>
                  </li>
                )
              })}
              {filtered.length === 0 && !showCreate ? (
                <p className="px-2 py-4 text-center text-xs text-muted-foreground">
                  No matching tags
                </p>
              ) : null}
            </ul>
          )}
          {showCreate ? (
            <button
              type="button"
              onClick={handleCreate}
              className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            >
              Create &quot;{query.trim()}&quot;
            </button>
          ) : null}
        </div>
      </div>

      {footer ? (
        <div className="flex flex-col gap-2 border-t border-border pt-2">
          {footer}
        </div>
      ) : null}
    </div>
  )
}
