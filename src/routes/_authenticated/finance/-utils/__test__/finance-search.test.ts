import { describe, expect, it } from 'vitest'

import { financeSearchSchema } from '../finance-search'

describe('financeSearchSchema', () => {
  it('accepts view=archive', () => {
    const result = financeSearchSchema.parse({ view: 'archive' })
    expect(result.view).toBe('archive')
  })

  it('accepts view=chart and view=table', () => {
    expect(financeSearchSchema.parse({ view: 'chart' }).view).toBe('chart')
    expect(financeSearchSchema.parse({ view: 'table' }).view).toBe('table')
  })

  it('falls back to chart for an unknown view', () => {
    const result = financeSearchSchema.parse({ view: 'unknown' })
    expect(result.view).toBe('chart')
  })
})
