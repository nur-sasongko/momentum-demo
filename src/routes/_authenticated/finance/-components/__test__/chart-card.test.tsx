import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ChartCard } from '../chart-card'

import type { ComponentProps } from 'react'

beforeEach(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  )
})

afterEach(() => {
  vi.unstubAllGlobals()
})

function renderChartCard(
  overrides: Partial<ComponentProps<typeof ChartCard>> = {},
) {
  return render(
    <ChartCard
      title="Spending by category"
      description="Expenses — Jul 1 – Jul 31"
      isEmpty={false}
      emptyMessage="No expenses recorded for this period."
      {...overrides}
    >
      <div data-testid="chart-child" />
    </ChartCard>,
  )
}

describe('ChartCard zoom controls', () => {
  it('renders zoom controls when zoomable is set', () => {
    renderChartCard({ zoomable: true, dataLength: 5 })

    expect(screen.getByLabelText('Zoom in')).toBeTruthy()
    expect(screen.getByLabelText('Zoom out')).toBeTruthy()
    expect(screen.getByText('100%')).toBeTruthy()
  })

  it('does not render zoom controls when zoomable is not set', () => {
    renderChartCard({ zoomable: false })

    expect(screen.queryByLabelText('Zoom in')).toBeNull()
    expect(screen.queryByLabelText('Zoom out')).toBeNull()
  })

  it('does not render zoom controls in the empty state even when zoomable is set', () => {
    renderChartCard({ zoomable: true, isEmpty: true, dataLength: 0 })

    expect(screen.queryByLabelText('Zoom in')).toBeNull()
    expect(screen.queryByLabelText('Zoom out')).toBeNull()
    expect(
      screen.getByText('No expenses recorded for this period.'),
    ).toBeTruthy()
  })

  it('updates the percentage readout when zooming in', () => {
    renderChartCard({ zoomable: true, dataLength: 5 })

    fireEvent.click(screen.getByLabelText('Zoom in'))

    expect(screen.getByText('125%')).toBeTruthy()
  })

  it('disables zoom out and reset at 100%', () => {
    renderChartCard({ zoomable: true, dataLength: 5 })

    expect(screen.getByLabelText('Zoom out').closest('button')).toHaveProperty(
      'disabled',
      true,
    )
    expect(
      screen.getByLabelText('Reset zoom').closest('button'),
    ).toHaveProperty('disabled', true)
  })

  it('enables reset once zoomed in, and reset returns to 100%', () => {
    renderChartCard({ zoomable: true, dataLength: 5 })

    fireEvent.click(screen.getByLabelText('Zoom in'))
    expect(screen.getByText('125%')).toBeTruthy()
    expect(screen.getByLabelText('Zoom out').closest('button')).toHaveProperty(
      'disabled',
      false,
    )

    const resetButton = screen.getByLabelText('Reset zoom')
    expect(resetButton.closest('button')).toHaveProperty('disabled', false)

    fireEvent.click(resetButton)

    expect(screen.getByText('100%')).toBeTruthy()
    expect(resetButton.closest('button')).toHaveProperty('disabled', true)
  })
})
