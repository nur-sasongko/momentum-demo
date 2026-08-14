import { getRouteApi } from '@tanstack/react-router'
import { useCallback, useRef } from 'react'

import { toggleArrayValue } from '#/utils/search-params'
import { NOTES_ROUTE_ID } from './notes-route-search'

import type {
  NotesSearch,
  NotesSortBy,
  TagFilterMode,
} from './notes-route-search'

const routeApi = getRouteApi(NOTES_ROUTE_ID)

/**
 * Reads/writes Notes filter, sort, and selection state from the URL,
 * exposing the same field and action names the old `useNotesStore` slice
 * used, so migrating a component is a one-line hook swap.
 *
 * Every action is `useCallback`-stable, matching the identity guarantee
 * Zustand actions had. Callers put these in effect dependency arrays, and a
 * fresh identity per render would re-fire those effects — each redundant
 * `navigate()` to an unchanged URL makes the router re-run the route
 * loader, which renders again, which fires the effect again.
 */
export function useNotesFilters() {
  const search = routeApi.useSearch()
  const navigate = routeApi.useNavigate()

  // Lets the stable actions below read current filter values without
  // taking them as `useCallback` dependencies.
  const searchRef = useRef(search)
  searchRef.current = search

  const selectedId = search.note ?? null
  const searchQuery = search.q
  const activeTags = search.tags
  const tagFilterMode: TagFilterMode = search.tagMode
  const untaggedOnly = search.untagged
  const favoritesOnly = search.fav
  const sortBy: NotesSortBy = search.sort

  const apply = useCallback(
    (patch: Partial<NotesSearch>, opts?: { replace?: boolean }) => {
      void navigate({
        search: (prev) => ({ ...prev, ...patch }),
        replace: opts?.replace ?? false,
        resetScroll: false,
      })
    },
    [navigate],
  )

  const selectNote = useCallback(
    (id: string | null, opts?: { replace?: boolean }) => {
      apply({ note: id ?? undefined }, opts)
    },
    [apply],
  )

  const setSearch = useCallback(
    (query: string) => {
      apply({ q: query }, { replace: true })
    },
    [apply],
  )

  const setActiveTags = useCallback(
    (tags: string[]) => {
      apply({
        tags,
        untagged: tags.length > 0 ? false : searchRef.current.untagged,
      })
    },
    [apply],
  )

  const toggleActiveTag = useCallback(
    (tag: string) => {
      const current = searchRef.current
      const { next, isBoundary } = toggleArrayValue(current.tags, tag)
      apply(
        { tags: next, untagged: next.length > 0 ? false : current.untagged },
        { replace: !isBoundary },
      )
    },
    [apply],
  )

  const setTagFilterMode = useCallback(
    (mode: TagFilterMode) => {
      apply({ tagMode: mode })
    },
    [apply],
  )

  const setUntaggedOnly = useCallback(
    (value: boolean) => {
      apply({ untagged: value, tags: value ? [] : searchRef.current.tags })
    },
    [apply],
  )

  const setFavoritesOnly = useCallback(
    (value: boolean) => {
      apply({ fav: value })
    },
    [apply],
  )

  const setSortBy = useCallback(
    (sort: NotesSortBy) => {
      apply({ sort })
    },
    [apply],
  )

  return {
    selectedId,
    searchQuery,
    activeTags,
    tagFilterMode,
    untaggedOnly,
    favoritesOnly,
    sortBy,
    selectNote,
    setSearch,
    setActiveTags,
    toggleActiveTag,
    setTagFilterMode,
    setUntaggedOnly,
    setFavoritesOnly,
    setSortBy,
  }
}
