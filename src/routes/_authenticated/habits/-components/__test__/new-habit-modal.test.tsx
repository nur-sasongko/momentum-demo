import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { useHabitsStore } from '#/stores/habits-store'
import { NewHabitModal } from '../new-habit-modal'

beforeEach(() => {
  useHabitsStore.setState({ habits: [], isNewHabitOpen: true })
})

afterEach(() => {
  // Closing via the store (rather than a user interaction) drives the
  // `Dialog`'s `Presence` from open to closed outside of any user event, so
  // the update has to be wrapped explicitly — otherwise it can land after
  // RTL's own `cleanup()` unmounts the tree, unwrapped in `act(...)`.
  act(() => {
    useHabitsStore.setState({ isNewHabitOpen: false })
  })
})

describe('NewHabitModal — discard/stay confirmation', () => {
  it('closes immediately with no dialog when unedited', () => {
    render(<NewHabitModal />)

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(screen.queryByText('Discard unsaved changes?')).toBeNull()
    expect(useHabitsStore.getState().isNewHabitOpen).toBe(false)
  })

  it('shows the confirmation dialog after typing a name', async () => {
    render(<NewHabitModal />)

    await act(async () => {
      fireEvent.change(screen.getByLabelText('Name'), {
        target: { value: 'Morning run' },
      })
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    })

    expect(screen.getByText('Discard unsaved changes?')).toBeTruthy()
    expect(useHabitsStore.getState().isNewHabitOpen).toBe(true)
  })

  it('"Keep editing" leaves the modal open with the draft intact', async () => {
    render(<NewHabitModal />)

    await act(async () => {
      fireEvent.change(screen.getByLabelText('Name'), {
        target: { value: 'Morning run' },
      })
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Keep editing' }))
    })

    expect(screen.queryByText('Discard unsaved changes?')).toBeNull()
    expect(useHabitsStore.getState().isNewHabitOpen).toBe(true)
    expect(screen.getByLabelText('Name')).toHaveProperty('value', 'Morning run')
  })

  it('"Discard changes" closes the modal and resets the form', async () => {
    render(<NewHabitModal />)

    await act(async () => {
      fireEvent.change(screen.getByLabelText('Name'), {
        target: { value: 'Morning run' },
      })
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Discard changes' }))
    })

    expect(useHabitsStore.getState().isNewHabitOpen).toBe(false)
  })
})
