import { createFileRoute, stripSearchParams } from '@tanstack/react-router'
import { Brain, Wallet } from 'lucide-react'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '#/components/ui/tabs'
import { ArchivedTransactionsTable } from '#/routes/_authenticated/finance/-components/archived-transactions-table'
import { useArchivedTransactionsCountQuery } from '#/routes/_authenticated/finance/-utils/finance-queries'
import { ArchivedNotesTable } from '#/routes/_authenticated/notes/-components/archived-notes-table'
import { useArchivedNotesCountQuery } from '#/routes/_authenticated/notes/-utils/notes-queries'
import {
  ARCHIVE_SEARCH_DEFAULTS,
  archiveSearchSchema,
} from './-utils/archive-search'
import { useArchiveTab } from './-utils/use-archive-tab'

import type { ArchiveTab } from './-utils/archive-search'

export const Route = createFileRoute('/_authenticated/archive/')({
  head: () => ({
    meta: [{ title: 'Archive — Momentum' }],
  }),
  validateSearch: archiveSearchSchema,
  search: {
    middlewares: [stripSearchParams(ARCHIVE_SEARCH_DEFAULTS)],
  },
  component: ArchivePage,
})

function tabLabel(base: string, count: number | undefined): string {
  return count === undefined ? base : `${base} (${count})`
}

function ArchivePage() {
  const { tab, setTab } = useArchiveTab()
  const notesCountQuery = useArchivedNotesCountQuery()
  const transactionsCountQuery = useArchivedTransactionsCountQuery()

  return (
    <div className="route-fade-in space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Archive</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Deleted items are kept for 30 days, then permanently removed.
        </p>
      </div>

      <Tabs
        value={tab}
        onValueChange={(v) => setTab(v as ArchiveTab)}
        className="space-y-4"
      >
        <TabsList>
          <TabsTrigger value="notes">
            <Brain />
            {tabLabel('Second Brain', notesCountQuery.data)}
          </TabsTrigger>
          <TabsTrigger value="transactions">
            <Wallet />
            {tabLabel('Finance', transactionsCountQuery.data)}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="notes">
          <ArchivedNotesTable />
        </TabsContent>
        <TabsContent value="transactions">
          <ArchivedTransactionsTable />
        </TabsContent>
      </Tabs>
    </div>
  )
}
