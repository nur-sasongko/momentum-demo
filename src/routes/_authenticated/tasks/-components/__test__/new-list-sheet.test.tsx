import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useTasksStore } from '#/stores/tasks-store'
import { NewListSheet } from '../new-list-sheet'
import {
  useCreateListMutation,
  useUpdateListMutation,
} from '../../-utils/tasks-queries'

import type { TaskList } from '#/stores/tasks-store'
import type { Mock } from 'vitest'

vi.mock('../../-utils/tasks-queries', () => ({
  useCreateListMutation: vi.fn(),
  useUpdateListMutation: vi.fn(),
}))

const useCreateListMutationMock = useCreateListMutation as unknown as Mock
const useUpdateListMutationMock = useUpdateListMutation as unknown as Mock

const existingList: TaskList = {
  id: 'list-1',
  name: 'Work',
  color: '#0ea5e9',
  order: 0,
  createdAt: '2026-01-01T00:00:00.000Z',
}

function mockMatchMedia() {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  })
}

beforeEach(() => {
  mockMatchMedia()
  useTasksStore.setState({ lists: [existingList] })
  useCreateListMutationMock.mockReturnValue({
    mutateAsync: vi.fn(),
    isPending: false,
  })
  useUpdateListMutationMock.mockReturnValue({
    mutateAsync: vi.fn(),
    isPending: false,
  })
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('NewListSheet — create mode', () => {
  it('closes immediately with no dialog when unedited', () => {
    const onOpenChange = vi.fn()
    render(<NewListSheet open onOpenChange={onOpenChange} />)

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(screen.queryByText('Discard unsaved changes?')).toBeNull()
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('shows the confirmation dialog after typing a name', () => {
    const onOpenChange = vi.fn()
    render(<NewListSheet open onOpenChange={onOpenChange} />)

    fireEvent.change(screen.getByLabelText('List Name'), {
      target: { value: 'Personal' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(screen.getByText('Discard unsaved changes?')).toBeTruthy()
    expect(onOpenChange).not.toHaveBeenCalled()
  })
})

describe('NewListSheet — edit mode', () => {
  it('closes immediately with no dialog when the fields are unchanged', () => {
    const onOpenChange = vi.fn()
    render(
      <NewListSheet
        open
        onOpenChange={onOpenChange}
        editListId={existingList.id}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(screen.queryByText('Discard unsaved changes?')).toBeNull()
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('shows the confirmation dialog when the name is changed', () => {
    const onOpenChange = vi.fn()
    render(
      <NewListSheet
        open
        onOpenChange={onOpenChange}
        editListId={existingList.id}
      />,
    )

    fireEvent.change(screen.getByLabelText('List Name'), {
      target: { value: 'Work (renamed)' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(screen.getByText('Discard unsaved changes?')).toBeTruthy()
    expect(onOpenChange).not.toHaveBeenCalled()
  })

  it('"Discard changes" closes the sheet', () => {
    const onOpenChange = vi.fn()
    render(
      <NewListSheet
        open
        onOpenChange={onOpenChange}
        editListId={existingList.id}
      />,
    )

    fireEvent.change(screen.getByLabelText('List Name'), {
      target: { value: 'Work (renamed)' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    fireEvent.click(screen.getByRole('button', { name: 'Discard changes' }))

    expect(onOpenChange).toHaveBeenCalledWith(false)
  })
})
