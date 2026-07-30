import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useTasksStore } from '#/stores/tasks-store'
import { AddTaskSheet } from '../add-task-sheet'
import { useCreateTaskMutation } from '../../-utils/tasks-queries'

import type { TaskList } from '#/stores/tasks-store'
import type { Mock } from 'vitest'

vi.mock('../../-utils/tasks-queries', () => ({
  useCreateTaskMutation: vi.fn(),
}))

const useCreateTaskMutationMock = useCreateTaskMutation as unknown as Mock

const lists: TaskList[] = [
  {
    id: 'list-1',
    name: 'Inbox',
    order: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
  },
]

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
  useTasksStore.setState({ tasks: [] })
  useCreateTaskMutationMock.mockReturnValue({
    mutateAsync: vi.fn(),
    isPending: false,
  })
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('AddTaskSheet — discard/stay confirmation', () => {
  it('closes immediately with no dialog when unedited', () => {
    const onOpenChange = vi.fn()
    render(<AddTaskSheet open onOpenChange={onOpenChange} lists={lists} />)

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(screen.queryByText('Discard unsaved changes?')).toBeNull()
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('shows the confirmation dialog when closing with a title typed', () => {
    const onOpenChange = vi.fn()
    render(<AddTaskSheet open onOpenChange={onOpenChange} lists={lists} />)

    fireEvent.change(screen.getByLabelText('Title'), {
      target: { value: 'Buy milk' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(screen.getByText('Discard unsaved changes?')).toBeTruthy()
    expect(onOpenChange).not.toHaveBeenCalled()
  })

  it('"Keep editing" leaves the sheet open with the draft intact', () => {
    const onOpenChange = vi.fn()
    render(<AddTaskSheet open onOpenChange={onOpenChange} lists={lists} />)

    fireEvent.change(screen.getByLabelText('Title'), {
      target: { value: 'Buy milk' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    fireEvent.click(screen.getByRole('button', { name: 'Keep editing' }))

    expect(screen.queryByText('Discard unsaved changes?')).toBeNull()
    expect(onOpenChange).not.toHaveBeenCalled()
    expect(screen.getByLabelText('Title')).toHaveProperty('value', 'Buy milk')
  })

  it('"Discard changes" closes the sheet', () => {
    const onOpenChange = vi.fn()
    render(<AddTaskSheet open onOpenChange={onOpenChange} lists={lists} />)

    fireEvent.change(screen.getByLabelText('Title'), {
      target: { value: 'Buy milk' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    fireEvent.click(screen.getByRole('button', { name: 'Discard changes' }))

    expect(onOpenChange).toHaveBeenCalledWith(false)
  })
})
