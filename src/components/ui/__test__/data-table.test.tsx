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
