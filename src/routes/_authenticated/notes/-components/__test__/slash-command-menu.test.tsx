import { act, render, screen } from '@testing-library/react'
import { createRef } from 'react'
import { describe, expect, it, vi } from 'vitest'

import type { SlashCommandItem } from '#/routes/_authenticated/notes/-components/slash-command-extension'
import type { SlashCommandMenuRef } from '#/routes/_authenticated/notes/-components/slash-command-menu'
import { SlashCommandMenu } from '#/routes/_authenticated/notes/-components/slash-command-menu'

const items: SlashCommandItem[] = [
  {
    id: 'text',
    title: 'Text',
    command: vi.fn(),
  },
  {
    id: 'heading-1',
    title: 'Heading 1',
    command: vi.fn(),
  },
  {
    id: 'heading-2',
    title: 'Heading 2',
    command: vi.fn(),
  },
]

function createKeyEvent(key: string) {
  return {
    key,
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
  } as unknown as KeyboardEvent
}

function expectSelectedButton(title: RegExp) {
  const button = screen.getByRole('button', { name: title })
  expect(button.className).toContain('bg-accent')
}

describe('SlashCommandMenu keyboard navigation', () => {
  it('moves selection down with ArrowDown', () => {
    const ref = createRef<SlashCommandMenuRef>()

    render(
      <SlashCommandMenu
        ref={ref}
        items={items}
        command={vi.fn()}
        editor={{} as never}
        range={{ from: 0, to: 1 }}
      />,
    )

    expectSelectedButton(/Text/i)

    act(() => {
      ref.current?.onKeyDown({
        event: createKeyEvent('ArrowDown'),
      } as never)
    })

    expectSelectedButton(/Heading 1/i)
  })

  it('does not reset selection when items array reference changes', () => {
    const ref = createRef<SlashCommandMenuRef>()

    const { rerender } = render(
      <SlashCommandMenu
        ref={ref}
        items={items}
        command={vi.fn()}
        editor={{} as never}
        range={{ from: 0, to: 1 }}
      />,
    )

    act(() => {
      ref.current?.onKeyDown({
        event: createKeyEvent('ArrowDown'),
      } as never)
    })

    rerender(
      <SlashCommandMenu
        ref={ref}
        items={[...items]}
        command={vi.fn()}
        editor={{} as never}
        range={{ from: 0, to: 1 }}
      />,
    )

    expectSelectedButton(/Heading 1/i)
  })

  it('resets selection when filtered items change', () => {
    const ref = createRef<SlashCommandMenuRef>()

    const { rerender } = render(
      <SlashCommandMenu
        ref={ref}
        items={items}
        command={vi.fn()}
        editor={{} as never}
        range={{ from: 0, to: 1 }}
      />,
    )

    act(() => {
      ref.current?.onKeyDown({
        event: createKeyEvent('ArrowDown'),
      } as never)
    })

    rerender(
      <SlashCommandMenu
        ref={ref}
        items={items.slice(0, 1)}
        command={vi.fn()}
        editor={{} as never}
        range={{ from: 0, to: 1 }}
      />,
    )

    expectSelectedButton(/Text/i)
  })
})
