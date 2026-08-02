import { useState } from 'react'

import type { DrilldownSelection } from './finance-drilldown'

/** Local, ephemeral state for the currently open drilldown sheet — never persisted. */
export function useDrilldown() {
  const [state, setState] = useState<DrilldownSelection | null>(null)

  return {
    state,
    open: (selection: DrilldownSelection) => setState(selection),
    close: () => setState(null),
  }
}
