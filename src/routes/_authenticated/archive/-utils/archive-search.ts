import { z } from 'zod'

export const ARCHIVE_ROUTE_ID = '/_authenticated/archive/' as const

export const archiveSearchSchema = z.object({
  tab: z.enum(['notes', 'transactions']).catch('notes'),
})

export type ArchiveSearch = z.infer<typeof archiveSearchSchema>
export type ArchiveTab = ArchiveSearch['tab']

export const ARCHIVE_SEARCH_DEFAULTS: ArchiveSearch = {
  tab: 'notes',
}
