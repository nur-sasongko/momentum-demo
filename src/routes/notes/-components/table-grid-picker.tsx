import { useState } from 'react'

import { cn } from '#/libs/utils'

const MAX_GRID = 6

interface TableGridPickerProps {
  onSelect: (rows: number, cols: number) => void
  onCancel?: () => void
}

export function TableGridPicker({ onSelect, onCancel }: TableGridPickerProps) {
  const [hover, setHover] = useState({ rows: 0, cols: 0 })

  return (
    <div className="w-72 rounded-lg border border-border bg-popover p-3 shadow-lg">
      <p className="mb-2 text-xs text-muted-foreground">
        {hover.rows > 0 && hover.cols > 0
          ? `${hover.cols} × ${hover.rows} table`
          : 'Choose table size'}
      </p>
      <div
        className="grid gap-1"
        style={{ gridTemplateColumns: `repeat(${MAX_GRID}, minmax(0, 1fr))` }}
        onMouseLeave={() => setHover({ rows: 0, cols: 0 })}
      >
        {Array.from({ length: MAX_GRID * MAX_GRID }, (_, index) => {
          const row = Math.floor(index / MAX_GRID) + 1
          const col = (index % MAX_GRID) + 1
          const isActive = row <= hover.rows && col <= hover.cols

          return (
            <button
              key={`${row}-${col}`}
              type="button"
              className={cn(
                'size-5 rounded-sm border border-border transition-colors',
                isActive
                  ? 'border-primary bg-primary/20'
                  : 'bg-muted/40 hover:bg-muted',
              )}
              onMouseEnter={() => setHover({ rows: row, cols: col })}
              onMouseDown={(event) => {
                event.preventDefault()
                onSelect(row, col)
              }}
            />
          )
        })}
      </div>
      <div className="mt-3 flex items-center justify-between gap-2">
        <button
          type="button"
          className="text-xs text-muted-foreground hover:text-foreground"
          onMouseDown={(event) => {
            event.preventDefault()
            const cols = window.prompt('Columns (1–20)', '8')
            const rows = window.prompt('Rows (1–20)', '6')
            if (!cols || !rows) {
              return
            }
            const parsedCols = Number.parseInt(cols, 10)
            const parsedRows = Number.parseInt(rows, 10)
            if (
              Number.isNaN(parsedCols) ||
              Number.isNaN(parsedRows) ||
              parsedCols < 1 ||
              parsedRows < 1
            ) {
              return
            }
            onSelect(parsedRows, parsedCols)
          }}
        >
          Custom size…
        </button>
        {onCancel ? (
          <button
            type="button"
            className="text-xs text-muted-foreground hover:text-foreground"
            onMouseDown={(event) => {
              event.preventDefault()
              onCancel()
            }}
          >
            Cancel
          </button>
        ) : null}
      </div>
    </div>
  )
}
