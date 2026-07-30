import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { useHabitsStore } from '#/stores/habits-store'
import { NewHabitModal } from '../new-habit-modal'

beforeEach(() => {
  useHabitsStore.setState({ habits: [], isNewHabitOpen: true })
})

afterEach(() => {
  useHabitsStore.setState({ isNewHabitOpen: false })
})

describe('NewHabitModal — discard/stay confirmation', () => {
  it('closes immediately with no dialog when unedited', () => {
    render(<NewHabitModal />)

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(screen.queryByText('Discard unsaved changes?')).toBeNull()
    expect(useHabitsStore.getState().isNewHabitOpen).toBe(false)
  })

  it('shows the confirmation dialog after typing a name', () => {
    render(<NewHabitModal />)

    fireEvent.change(screen.getByLabelText('Name'), {
      target: { value: 'Morning run' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(screen.getByText('Discard unsaved changes?')).toBeTruthy()
    expect(useHabitsStore.getState().isNewHabitOpen).toBe(true)
  })

  it('"Keep editing" leaves the modal open with the draft intact', () => {
    render(<NewHabitModal />)

    fireEvent.change(screen.getByLabelText('Name'), {
      target: { value: 'Morning run' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    fireEvent.click(screen.getByRole('button', { name: 'Keep editing' }))

    expect(screen.queryByText('Discard unsaved changes?')).toBeNull()
    expect(useHabitsStore.getState().isNewHabitOpen).toBe(true)
    expect(screen.getByLabelText('Name')).toHaveProperty('value', 'Morning run')
  })

  it('"Discard changes" closes the modal and resets the form', () => {
    render(<NewHabitModal />)

    fireEvent.change(screen.getByLabelText('Name'), {
      target: { value: 'Morning run' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    fireEvent.click(screen.getByRole('button', { name: 'Discard changes' }))

    expect(useHabitsStore.getState().isNewHabitOpen).toBe(false)
  })
})
