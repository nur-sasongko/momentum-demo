import { useEffect, useRef } from 'react'

import { cn } from '#/libs/utils'

export function fuzzyMatch(query: string, target: string): boolean {
  const normalizedQuery = query.trim().toLowerCase()
  if (!normalizedQuery) {
    return true
  }

  const normalizedTarget = target.toLowerCase()
  let queryIndex = 0

  for (const char of normalizedTarget) {
    if (char === normalizedQuery[queryIndex]) {
      queryIndex += 1
      if (queryIndex === normalizedQuery.length) {
        return true
      }
    }
  }

  return false
}

export interface SuggestionMenuItem {
  id: string
  title: string
  description?: string
  keywords?: string[]
}

interface SuggestionMenuProps<T extends SuggestionMenuItem> {
  items: T[]
  selectedIndex: number
  onSelect: (item: T) => void
  emptyMessage?: string
}

export function SuggestionMenu<T extends SuggestionMenuItem>({
  items,
  selectedIndex,
  onSelect,
  emptyMessage = 'No results',
}: SuggestionMenuProps<T>) {
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([])

  useEffect(() => {
    const selectedItem = itemRefs.current[selectedIndex]
    if (typeof selectedItem?.scrollIntoView === 'function') {
      selectedItem.scrollIntoView({ block: 'nearest' })
    }
  }, [selectedIndex, items.length])

  if (items.length === 0) {
    return (
      <div className="z-50 w-72 overflow-hidden rounded-lg border border-border bg-popover p-2 text-sm text-muted-foreground shadow-lg">
        {emptyMessage}
      </div>
    )
  }

  return (
    <div className="z-50 max-h-80 w-72 overflow-y-auto rounded-lg border border-border bg-popover p-1 shadow-lg">
      {items.map((item, index) => (
        <button
          key={item.id}
          ref={(element) => {
            itemRefs.current[index] = element
          }}
          type="button"
          className={cn(
            'flex w-full flex-col rounded-md px-3 py-2 text-left transition-colors',
            index === selectedIndex
              ? 'bg-accent text-accent-foreground'
              : 'hover:bg-muted/60',
          )}
          onMouseDown={(event) => {
            event.preventDefault()
            onSelect(item)
          }}
        >
          <span className="text-sm font-medium">{item.title}</span>
          {item.description ? (
            <span className="text-xs text-muted-foreground">
              {item.description}
            </span>
          ) : null}
        </button>
      ))}
    </div>
  )
}

export function filterSuggestionItems<T extends SuggestionMenuItem>(
  items: T[],
  query: string,
): T[] {
  const normalizedQuery = query.trim().toLowerCase()
  if (!normalizedQuery) {
    return items
  }

  return items.filter((item) => {
    const haystack = [
      item.title,
      item.description ?? '',
      ...(item.keywords ?? []),
    ]
      .join(' ')
      .toLowerCase()

    return fuzzyMatch(normalizedQuery, haystack)
  })
}
