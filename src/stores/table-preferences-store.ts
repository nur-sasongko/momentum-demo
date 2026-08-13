import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import type { ColumnSizingState } from '@tanstack/react-table'

export type TableDensity = 'compact' | 'default' | 'comfortable'

export interface TablePreferences {
  columnSizing: ColumnSizingState
  density: TableDensity
}

const DEFAULT_PREFERENCES: TablePreferences = {
  columnSizing: {},
  density: 'default',
}

interface TablePreferencesState {
  tables: Partial<Record<string, TablePreferences>>
  getPreferences: (tableId: string) => TablePreferences
  setColumnSizing: (tableId: string, sizing: ColumnSizingState) => void
  resetColumnSizing: (tableId: string) => void
  setDensity: (tableId: string, density: TableDensity) => void
}

export const useTablePreferencesStore = create<TablePreferencesState>()(
  persist(
    (set, get) => ({
      tables: {},

      getPreferences: (tableId) => get().tables[tableId] ?? DEFAULT_PREFERENCES,

      setColumnSizing: (tableId, sizing) =>
        set((state) => ({
          tables: {
            ...state.tables,
            [tableId]: {
              ...(state.tables[tableId] ?? DEFAULT_PREFERENCES),
              columnSizing: sizing,
            },
          },
        })),

      resetColumnSizing: (tableId) =>
        set((state) => {
          const existing = state.tables[tableId]
          if (!existing) return state
          return {
            tables: {
              ...state.tables,
              [tableId]: { ...existing, columnSizing: {} },
            },
          }
        }),

      setDensity: (tableId, density) =>
        set((state) => ({
          tables: {
            ...state.tables,
            [tableId]: {
              ...(state.tables[tableId] ?? DEFAULT_PREFERENCES),
              density,
            },
          },
        })),
    }),
    {
      name: 'momentum-table-preferences',
      version: 1,
    },
  ),
)
