import { X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { Badge } from '#/components/ui/badge'
import { cn } from '#/libs/utils'
import { addTagsCaseInsensitive, normalizeTag } from '../-utils/notes-utils'

interface TagInputProps {
  value: string[]
  onChange: (next: string[]) => void
  suggestions: string[]
  disabled?: boolean
  placeholder?: string
}

const MAX_SUGGESTIONS = 8

export function TagInput({
  value,
  onChange,
  suggestions,
  disabled,
  placeholder = 'Add tag…',
}: TagInputProps) {
  const [inputValue, setInputValue] = useState('')
  const [focused, setFocused] = useState(false)
  const [highlightIndex, setHighlightIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const lowerValue = value.map((v) => v.toLowerCase())
  const query = inputValue.trim().toLowerCase()
  const filteredSuggestions = suggestions
    .filter((s) => !lowerValue.includes(s.toLowerCase()))
    .filter((s) => (query ? s.toLowerCase().includes(query) : true))
    .slice(0, MAX_SUGGESTIONS)

  useEffect(() => {
    setHighlightIndex(0)
  }, [inputValue])

  useEffect(() => {
    if (!focused) return
    function handleClick(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setFocused(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [focused])

  const commitTag = (raw: string) => {
    const normalized = normalizeTag(raw)
    if (!normalized) return
    const next = addTagsCaseInsensitive(value, normalized)
    if (next !== value) onChange(next)
    setInputValue('')
  }

  const removeTag = (tag: string) => {
    onChange(value.filter((t) => t !== tag))
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault()
      const fromSuggestion =
        query && filteredSuggestions.length > 0
          ? filteredSuggestions[highlightIndex]
          : null
      commitTag(fromSuggestion ?? inputValue)
    } else if (event.key === 'Backspace' && !inputValue && value.length > 0) {
      event.preventDefault()
      removeTag(value[value.length - 1])
    } else if (event.key === 'Escape') {
      event.preventDefault()
      setInputValue('')
      setFocused(false)
      inputRef.current?.blur()
    } else if (event.key === 'ArrowDown') {
      if (filteredSuggestions.length === 0) return
      event.preventDefault()
      setHighlightIndex((i) => Math.min(i + 1, filteredSuggestions.length - 1))
    } else if (event.key === 'ArrowUp') {
      if (filteredSuggestions.length === 0) return
      event.preventDefault()
      setHighlightIndex((i) => Math.max(i - 1, 0))
    }
  }

  if (disabled) {
    if (value.length === 0) {
      return (
        <span className="text-xs text-muted-foreground italic">No tags</span>
      )
    }
    return (
      <div className="flex flex-wrap items-center gap-1">
        {value.map((tag) => (
          <Badge key={tag} variant="secondary" className="font-normal">
            {tag}
          </Badge>
        ))}
      </div>
    )
  }

  const showSuggestions = focused && filteredSuggestions.length > 0

  return (
    <div
      ref={containerRef}
      className="relative flex min-w-0 flex-1 flex-wrap items-center gap-1"
    >
      {value.map((tag) => (
        <Badge
          key={tag}
          variant="secondary"
          className="gap-0.5 pr-1 font-normal"
        >
          <span>{tag}</span>
          <button
            type="button"
            onClick={() => removeTag(tag)}
            className="ml-0.5 rounded-full p-0.5 text-muted-foreground hover:bg-foreground/10 hover:text-foreground"
            aria-label={`Remove tag ${tag}`}
          >
            <X className="size-3" />
          </button>
        </Badge>
      ))}
      <input
        ref={inputRef}
        type="text"
        value={inputValue}
        onChange={(event) => setInputValue(event.target.value)}
        onFocus={() => setFocused(true)}
        onKeyDown={handleKeyDown}
        placeholder={value.length === 0 ? placeholder : ''}
        className="min-w-[6rem] flex-1 border-0 bg-transparent text-xs text-foreground outline-none placeholder:text-muted-foreground"
        aria-label="Add tag"
      />
      {showSuggestions && (
        <ul
          role="listbox"
          className="absolute top-full left-0 z-30 mt-1 max-h-48 w-48 overflow-y-auto rounded-md border border-border bg-popover py-1 text-xs shadow-md"
        >
          {filteredSuggestions.map((suggestion, index) => (
            <li key={suggestion}>
              <button
                type="button"
                role="option"
                aria-selected={index === highlightIndex}
                onMouseEnter={() => setHighlightIndex(index)}
                onMouseDown={(event) => {
                  event.preventDefault()
                  commitTag(suggestion)
                  inputRef.current?.focus()
                }}
                className={cn(
                  'flex w-full items-center px-3 py-1.5 text-left',
                  index === highlightIndex
                    ? 'bg-accent text-accent-foreground'
                    : 'hover:bg-accent/50',
                )}
              >
                {suggestion}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
