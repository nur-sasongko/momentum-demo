import { ListFilter } from 'lucide-react'

import { Button } from '#/components/ui/button'
import { Checkbox } from '#/components/ui/checkbox'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '#/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#/components/ui/select'
import { cn } from '#/libs/utils'
import { TagPicker } from '#/routes/_authenticated/notes/-components/tag-picker'
import { useNoteTagsQuery } from '#/routes/_authenticated/notes/-utils/notes-queries'
import { useNotesFilters } from '#/routes/_authenticated/notes/-utils/use-notes-filters'
import type {
  NotesSortBy,
  TagFilterMode,
} from '#/routes/_authenticated/notes/-utils/notes-route-search'

const SORT_LABELS: Record<NotesSortBy, string> = {
  'updated-desc': 'Last updated',
  'created-desc': 'Recently created',
  'title-asc': 'Title A–Z',
  'title-desc': 'Title Z–A',
}

export function NotesFilterPopover() {
  const {
    activeTags,
    tagFilterMode,
    untaggedOnly,
    favoritesOnly,
    sortBy,
    toggleActiveTag,
    setTagFilterMode,
    setUntaggedOnly,
    setFavoritesOnly,
    clearAllFilters,
    setSortBy,
  } = useNotesFilters()

  const tagsQuery = useNoteTagsQuery()
  const counts = tagsQuery.data ?? []

  const activeCount =
    activeTags.length + (favoritesOnly ? 1 : 0) + (untaggedOnly ? 1 : 0)
  const showMatchMode = activeTags.length >= 2

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={
            activeCount > 0
              ? `Filter notes (${activeCount} active)`
              : 'Filter notes'
          }
          className="relative text-muted-foreground"
        >
          <ListFilter className="size-4" />
          {activeCount > 0 ? (
            <span
              aria-hidden="true"
              className="tabular absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-medium text-primary-foreground"
            >
              {activeCount}
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-3">
        <TagPicker
          selected={untaggedOnly ? [] : activeTags}
          counts={counts}
          onToggle={toggleActiveTag}
          disabled={untaggedOnly}
          footer={
            <>
              {showMatchMode ? (
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-muted-foreground">Match</span>
                  <div
                    role="group"
                    aria-label="Tag match mode"
                    className="inline-flex overflow-hidden rounded-md border border-border text-xs"
                  >
                    {(['OR', 'AND'] as TagFilterMode[]).map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => setTagFilterMode(mode)}
                        aria-pressed={tagFilterMode === mode}
                        className={cn(
                          'px-2 py-1 transition-colors',
                          tagFilterMode === mode
                            ? 'bg-primary text-primary-foreground'
                            : 'text-muted-foreground hover:text-foreground',
                        )}
                      >
                        {mode === 'OR' ? 'Any' : 'All'}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="flex flex-col gap-1.5 px-2">
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <Checkbox
                    checked={favoritesOnly}
                    onCheckedChange={(checked) =>
                      setFavoritesOnly(checked === true)
                    }
                  />
                  Favourites only
                </label>
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <Checkbox
                    checked={untaggedOnly}
                    onCheckedChange={(checked) =>
                      setUntaggedOnly(checked === true)
                    }
                  />
                  Untagged only
                </label>
              </div>

              <div className="flex items-center justify-between gap-2 border-t border-border px-2 pt-2">
                <span className="text-xs text-muted-foreground">Sort</span>
                <Select
                  value={sortBy}
                  onValueChange={(value) => setSortBy(value as NotesSortBy)}
                >
                  <SelectTrigger
                    size="sm"
                    className="h-7 w-40 text-xs"
                    aria-label="Sort notes"
                  >
                    <SelectValue placeholder="Sort" />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(SORT_LABELS) as NotesSortBy[]).map((key) => (
                      <SelectItem key={key} value={key} className="text-xs">
                        {SORT_LABELS[key]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="border-t border-border pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 w-full justify-start px-2 text-xs text-muted-foreground hover:text-foreground"
                  onClick={clearAllFilters}
                  disabled={activeCount === 0}
                >
                  Clear all
                </Button>
              </div>
            </>
          }
        />
        {untaggedOnly ? (
          <p className="mt-1 text-xs text-muted-foreground italic">
            Tag filters are unavailable while showing untagged notes only.
          </p>
        ) : null}
      </PopoverContent>
    </Popover>
  )
}
