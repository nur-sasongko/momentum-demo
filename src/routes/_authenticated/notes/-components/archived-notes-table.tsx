import { createColumnHelper } from '@tanstack/react-table'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'

import { ArchiveRowActions } from '#/components/archive-row-actions'
import { DataTable } from '#/components/ui/data-table'
import { formatExpiryLabel } from '#/utils/archive'
import { formatTimeSince } from '#/utils/date'
import {
  useArchivedNotesQuery,
  usePurgeNoteMutation,
  useRestoreNoteMutation,
} from '../-utils/notes-queries'

import type { ArchivedNote } from '../-types/notes-query'

const columnHelper = createColumnHelper<ArchivedNote>()
const PAGE_SIZE_OPTIONS = [10, 25, 50, 100]

function buildColumns(
  onRestore: (id: string) => void,
  onPurge: (id: string) => void,
) {
  return [
    columnHelper.accessor('title', {
      header: 'Title',
      size: 280,
      minSize: 160,
      meta: { overflow: 'truncate' },
      cell: (info) => info.row.original.title || 'Untitled',
    }),
    columnHelper.accessor((row) => row.tags.join(', '), {
      id: 'tags',
      header: 'Tags',
      size: 220,
      minSize: 120,
      meta: { overflow: 'truncate' },
      cell: (info) => {
        const tags = info.row.original.tags
        if (tags.length === 0) {
          return <span className="text-muted-foreground">—</span>
        }
        return (
          <div className="flex flex-wrap gap-x-2 gap-y-1">
            {tags.map((tag) => (
              <span key={tag} className="text-xs text-primary">
                #{tag}
              </span>
            ))}
          </div>
        )
      },
      enableSorting: false,
    }),
    columnHelper.accessor('deletedAt', {
      header: 'Deleted',
      size: 140,
      minSize: 110,
      cell: (info) => `${formatTimeSince(info.getValue())} ago`,
      sortingFn: 'alphanumeric',
    }),
    columnHelper.display({
      id: 'expires',
      header: 'Expires',
      size: 120,
      minSize: 100,
      cell: (info) => formatExpiryLabel(info.row.original.deletedAt),
    }),
    columnHelper.display({
      id: 'actions',
      size: 90,
      minSize: 90,
      enableResizing: false,
      enableSorting: false,
      meta: { align: 'right' },
      cell: (info) => {
        const row = info.row.original
        return (
          <ArchiveRowActions
            label={row.title || 'Untitled'}
            onRestore={() => onRestore(row.id)}
            onPurge={() => onPurge(row.id)}
          />
        )
      },
    }),
  ]
}

export function ArchivedNotesTable() {
  const [pageIndex, setPageIndex] = useState(0)
  const [pageSize, setPageSize] = useState(25)

  const { data, isFetching, isLoading } = useArchivedNotesQuery({
    page: pageIndex,
    pageSize,
  })
  const restoreMutation = useRestoreNoteMutation()
  const purgeMutation = usePurgeNoteMutation()

  const notes = data?.data ?? []
  const total = data?.count ?? 0
  const pageCount = Math.max(1, Math.ceil(total / pageSize))

  // Purging the last row on a page (or restoring it) can shrink pageCount
  // below the current page — fall back rather than showing an empty page.
  useEffect(() => {
    if (pageIndex > 0 && pageIndex >= pageCount) {
      setPageIndex(pageCount - 1)
    }
  }, [pageIndex, pageCount])

  const handleRestore = useCallback(
    (id: string) => {
      restoreMutation.mutate(id)
      toast.success('Note restored')
    },
    [restoreMutation],
  )

  const handlePurge = useCallback(
    (id: string) => {
      purgeMutation.mutate(id)
      toast.success('Note permanently deleted')
    },
    [purgeMutation],
  )

  const columns = useMemo(
    () => buildColumns(handleRestore, handlePurge),
    [handleRestore, handlePurge],
  )

  return (
    <DataTable
      columns={columns}
      data={notes}
      tableId="archive.notes"
      isLoading={isLoading}
      isFetching={isFetching}
      emptyMessage="Nothing in the archive."
      serverPagination={{
        pageIndex,
        pageSize,
        total,
        pageCount,
        pageSizeOptions: PAGE_SIZE_OPTIONS,
        onPageIndexChange: setPageIndex,
        onPageSizeChange: (size) => {
          setPageSize(size)
          setPageIndex(0)
        },
      }}
    />
  )
}
