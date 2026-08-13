import { beforeEach, describe, expect, it } from 'vitest'

import { useTablePreferencesStore } from '#/stores/table-preferences-store'

beforeEach(() => {
  useTablePreferencesStore.setState({ tables: {} })
})

describe('useTablePreferencesStore', () => {
  it('returns defaults for an unknown tableId rather than undefined', () => {
    const prefs = useTablePreferencesStore.getState().getPreferences('ghost')
    expect(prefs).toEqual({ columnSizing: {}, density: 'default' })
  })

  it('setColumnSizing for one table does not affect another', () => {
    const { setColumnSizing, getPreferences } =
      useTablePreferencesStore.getState()

    setColumnSizing('finance.transactions', { note: 320 })
    setColumnSizing('notes.list', { title: 200 })

    expect(getPreferences('finance.transactions').columnSizing).toEqual({
      note: 320,
    })
    expect(getPreferences('notes.list').columnSizing).toEqual({ title: 200 })
  })

  it('setDensity persists per table without touching column sizing', () => {
    const { setColumnSizing, setDensity, getPreferences } =
      useTablePreferencesStore.getState()

    setColumnSizing('finance.transactions', { note: 320 })
    setDensity('finance.transactions', 'compact')

    expect(getPreferences('finance.transactions')).toEqual({
      columnSizing: { note: 320 },
      density: 'compact',
    })
  })

  it('resetColumnSizing clears only that table entry', () => {
    const { setColumnSizing, resetColumnSizing, getPreferences } =
      useTablePreferencesStore.getState()

    setColumnSizing('finance.transactions', { note: 320 })
    setColumnSizing('notes.list', { title: 200 })
    resetColumnSizing('finance.transactions')

    expect(getPreferences('finance.transactions').columnSizing).toEqual({})
    expect(getPreferences('notes.list').columnSizing).toEqual({ title: 200 })
  })

  it('resetColumnSizing on a table with no preferences is a no-op', () => {
    const { resetColumnSizing, getPreferences } =
      useTablePreferencesStore.getState()

    resetColumnSizing('never-touched')

    expect(getPreferences('never-touched')).toEqual({
      columnSizing: {},
      density: 'default',
    })
  })
})
