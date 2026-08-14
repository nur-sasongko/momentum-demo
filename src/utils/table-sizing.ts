export type ColumnSizing = Record<string, number>

export interface ColumnSizeBounds {
  id: string
  minSize?: number
  maxSize?: number
}

/** Drops persisted widths for column ids that no longer exist in the table. */
export function pruneColumnSizing(
  sizing: ColumnSizing,
  knownIds: string[],
): ColumnSizing {
  const knownIdSet = new Set(knownIds)
  return Object.fromEntries(
    Object.entries(sizing).filter(([id]) => knownIdSet.has(id)),
  )
}

/** Clamps persisted widths into each column's current `[minSize, maxSize]`. */
export function clampColumnSizing(
  sizing: ColumnSizing,
  columns: ColumnSizeBounds[],
): ColumnSizing {
  const boundsById = new Map(columns.map((c) => [c.id, c]))
  return Object.fromEntries(
    Object.entries(sizing).map(([id, size]) => {
      const bounds = boundsById.get(id)
      if (!bounds) return [id, size]
      const min = bounds.minSize ?? 0
      const max = bounds.maxSize ?? Number.MAX_SAFE_INTEGER
      return [id, Math.min(Math.max(size, min), max)]
    }),
  )
}
