import { getRouteApi } from '@tanstack/react-router'
import { ARCHIVE_ROUTE_ID } from './archive-search'

import type { ArchiveTab } from './archive-search'

const routeApi = getRouteApi(ARCHIVE_ROUTE_ID)

/** Reads/writes the active `/archive` tab from the URL. */
export function useArchiveTab() {
  const search = routeApi.useSearch()
  const navigate = routeApi.useNavigate()

  function setTab(tab: ArchiveTab) {
    void navigate({
      search: (prev) => ({ ...prev, tab }),
      replace: true,
      resetScroll: false,
    })
  }

  return { tab: search.tab, setTab }
}
