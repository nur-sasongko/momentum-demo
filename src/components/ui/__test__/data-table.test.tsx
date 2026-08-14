import { createColumnHelper } from '@tanstack/react-table'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { DataTable } from '#/components/ui/data-table'

interface Row {
  id: string
  name: string
}

const columnHelper = createColumnHelper<Row>()
const data: Row[] = [
  { id: '1', name: 'Alpha' },
  { id: '2', name: 'Beta' },
]

describe('DataTable header', () => {
  it('renders a sort button that toggles sorting on click', () => {
    const columns = [columnHelper.accessor('name', { header: 'Name' })]
    render(<DataTable columns={columns} data={data} />)

    const button = screen.getByRole('button', { name: 'Name' })
    expect(screen.getAllByRole('row')[1].textContent).toContain('Alpha')

    fireEvent.click(button)
    expect(screen.getAllByRole('row')[1].textContent).toContain('Alpha')

    fireEvent.click(button)
    expect(screen.getAllByRole('row')[1].textContent).toContain('Beta')
  })

  it('does not render a sort button for a non-sortable column', () => {
    const columns = [
      columnHelper.display({
        id: 'actions',
        header: 'Actions',
        cell: () => null,
      }),
    ]
    render(<DataTable columns={columns} data={data} />)

    expect(screen.queryByRole('button', { name: 'Actions' })).toBeNull()
    expect(screen.getByText('Actions')).toBeTruthy()
  })

  it('renders a headerFilter node beside the header without triggering sort', () => {
    const columns = [
      columnHelper.accessor('name', {
        header: 'Name',
        meta: { headerFilter: <button type="button">filter-trigger</button> },
      }),
    ]
    render(<DataTable columns={columns} data={data} />)

    const filterButton = screen.getByRole('button', {
      name: 'filter-trigger',
    })
    expect(filterButton).toBeTruthy()

    fireEvent.click(filterButton)
    // Clicking the filter control must not toggle sorting on the column.
    expect(screen.getAllByRole('row')[1].textContent).toContain('Alpha')
  })
})

function getColWidth(name: string) {
  const table = document.querySelector('table') as HTMLTableElement
  return table.style.getPropertyValue(`--col-${name}-size`)
}

describe('DataTable column resizing', () => {
  function resizableColumns() {
    return [
      columnHelper.accessor('name', {
        header: 'Name',
        size: 100,
        minSize: 40,
        maxSize: 300,
      }),
      columnHelper.display({
        id: 'actions',
        header: 'Actions',
        size: 60,
        enableResizing: false,
        cell: () => null,
      }),
    ]
  }

  it('renders a resize handle per resizable column and none where enableResizing is false', () => {
    render(<DataTable columns={resizableColumns()} data={data} resizable />)

    expect(
      screen.getByRole('separator', { name: 'Resize Name column' }),
    ).toBeTruthy()
    expect(
      screen.queryByRole('separator', { name: /Resize Actions/ }),
    ).toBeNull()
  })

  it('renders no resize handles when resizable is not set', () => {
    render(<DataTable columns={resizableColumns()} data={data} />)
    expect(screen.queryByRole('separator')).toBeNull()
  })

  it('nudges width by 8px on ArrowRight, 32px on Shift+ArrowRight, and resets on Home', () => {
    render(<DataTable columns={resizableColumns()} data={data} resizable />)
    const handle = screen.getByRole('separator', { name: 'Resize Name column' })
    expect(getColWidth('name')).toBe('100px')

    fireEvent.keyDown(handle, { key: 'ArrowRight' })
    expect(getColWidth('name')).toBe('108px')

    fireEvent.keyDown(handle, { key: 'ArrowRight', shiftKey: true })
    expect(getColWidth('name')).toBe('140px')

    fireEvent.keyDown(handle, { key: 'ArrowLeft' })
    expect(getColWidth('name')).toBe('132px')

    fireEvent.keyDown(handle, { key: 'Home' })
    expect(getColWidth('name')).toBe('100px')
  })

  it('resets to the default width on double-click', () => {
    render(<DataTable columns={resizableColumns()} data={data} resizable />)
    const handle = screen.getByRole('separator', { name: 'Resize Name column' })

    fireEvent.keyDown(handle, { key: 'ArrowRight' })
    expect(getColWidth('name')).toBe('108px')

    fireEvent.doubleClick(handle)
    expect(getColWidth('name')).toBe('100px')
  })

  it('shows a "Reset widths" control only once a column has been customized, and it restores every column', () => {
    render(
      <DataTable
        columns={resizableColumns()}
        data={data}
        resizable
        tableId="test.reset-widths"
      />,
    )

    expect(screen.queryByRole('button', { name: 'Reset widths' })).toBeNull()

    const handle = screen.getByRole('separator', { name: 'Resize Name column' })
    fireEvent.keyDown(handle, { key: 'ArrowRight' })
    expect(getColWidth('name')).toBe('108px')

    const resetButton = screen.getByRole('button', { name: 'Reset widths' })
    fireEvent.click(resetButton)

    expect(getColWidth('name')).toBe('100px')
    expect(screen.queryByRole('button', { name: 'Reset widths' })).toBeNull()
  })
})

describe('DataTable column meta', () => {
  it('right-aligns both the header and its cells', () => {
    const columns = [
      columnHelper.accessor('name', {
        header: 'Name',
        meta: { align: 'right' },
      }),
    ]
    render(<DataTable columns={columns} data={data} />)

    const headerCell = screen.getByRole('columnheader', { name: 'Name' })
    expect(headerCell.className).toContain('text-right')

    const bodyCell = screen.getAllByRole('cell')[0]
    expect(bodyCell.className).toContain('text-right')
  })

  it('truncates overflow and exposes the full value as a title', () => {
    const columns = [
      columnHelper.accessor('name', {
        header: 'Name',
        meta: { overflow: 'truncate' },
      }),
    ]
    render(<DataTable columns={columns} data={data} />)

    const bodyCell = screen.getAllByRole('cell')[0]
    expect(bodyCell.className).toContain('truncate')
    expect(bodyCell.getAttribute('title')).toBe('Alpha')
  })
})

describe('DataTable density', () => {
  it('applies compact height/padding classes to the header and cells', () => {
    const columns = [columnHelper.accessor('name', { header: 'Name' })]
    render(<DataTable columns={columns} data={data} density="compact" />)

    const headerCell = screen.getByRole('columnheader', { name: 'Name' })
    expect(headerCell.className).toContain('h-8')

    const bodyCell = screen.getAllByRole('cell')[0]
    expect(bodyCell.className).toContain('py-1')
  })
})

describe('DataTable loading, fetching, and empty states', () => {
  it('renders capped skeleton rows matching the column count when isLoading', () => {
    const columns = [
      columnHelper.accessor('name', { header: 'Name' }),
      columnHelper.display({
        id: 'actions',
        header: 'Actions',
        cell: () => null,
      }),
    ]
    const { container } = render(
      <DataTable columns={columns} data={[]} isLoading />,
    )

    expect(container.querySelectorAll('tbody tr').length).toBe(8)
    expect(container.querySelectorAll('[data-slot="skeleton"]').length).toBe(16)
  })

  it('dims existing rows and marks the body busy while refetching', () => {
    const columns = [columnHelper.accessor('name', { header: 'Name' })]
    const { container } = render(
      <DataTable columns={columns} data={data} isFetching />,
    )

    expect(container.querySelector('tbody')?.getAttribute('aria-busy')).toBe(
      'true',
    )
    expect(screen.getAllByRole('row')[1].textContent).toContain('Alpha')
  })

  it('renders the provided empty icon and action when there are no rows', () => {
    const columns = [columnHelper.accessor('name', { header: 'Name' })]
    render(
      <DataTable
        columns={columns}
        data={[]}
        emptyIcon={<span data-testid="custom-empty-icon" />}
        emptyAction={<button type="button">Add thing</button>}
      />,
    )

    expect(screen.getByTestId('custom-empty-icon')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Add thing' })).toBeTruthy()
  })
})
