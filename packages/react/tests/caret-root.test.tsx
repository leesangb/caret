import { createRef } from 'react'
import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

const { attachCaretMock } = vi.hoisted(() => {
  const attachCaretMock = vi.fn(({ root }: { root: HTMLElement }) => {
    const mount = vi.fn()
    const unmount = vi.fn()

    return {
      root,
      mount,
      unmount
    }
  })

  return { attachCaretMock }
})

vi.mock('@caret/dom', () => ({
  attachCaret: attachCaretMock
}))

import { CaretRoot } from '../src'

afterEach(() => {
  vi.clearAllMocks()
})

describe('CaretRoot', () => {
  it('renders its child and mounts the DOM controller', () => {
    const { unmount } = render(
      <CaretRoot>
        <div>Hello</div>
      </CaretRoot>
    )

    const child = screen.getByText('Hello')
    const controller = attachCaretMock.mock.results[0]?.value as {
      mount: ReturnType<typeof vi.fn>
      unmount: ReturnType<typeof vi.fn>
      root: HTMLElement
    }

    expect(child).toBeInstanceOf(HTMLElement)
    expect(controller.root).toBe(child)
    expect(attachCaretMock).toHaveBeenCalledWith({ root: child })
    expect(controller.mount).toHaveBeenCalledTimes(1)

    unmount()

    expect(controller.unmount).toHaveBeenCalledTimes(1)
  })

  it('preserves an existing child ref while mounting the controller', () => {
    const childRef = createRef<HTMLDivElement>()

    render(
      <CaretRoot>
        <div ref={childRef}>Hello</div>
      </CaretRoot>
    )

    const child = screen.getByText('Hello')

    expect(childRef.current).toBe(child)
  })

  it('rebinds to a new root when the child element changes', () => {
    const { container, rerender, unmount } = render(
      <CaretRoot>
        <div>Hello</div>
      </CaretRoot>
    )

    const firstController = attachCaretMock.mock.results[0]?.value as {
      mount: ReturnType<typeof vi.fn>
      unmount: ReturnType<typeof vi.fn>
      root: HTMLElement
    }

    rerender(
      <CaretRoot>
        <section>Hello</section>
      </CaretRoot>
    )

    const secondController = attachCaretMock.mock.results[1]?.value as {
      mount: ReturnType<typeof vi.fn>
      unmount: ReturnType<typeof vi.fn>
      root: HTMLElement
    }
    const [firstCall, secondCall] = attachCaretMock.mock.calls as [
      [{ root: HTMLElement }],
      [{ root: HTMLElement }]
    ]

    expect(firstCall[0].root).not.toBe(secondCall[0].root)
    expect(firstCall[0].root.tagName).toBe('DIV')
    expect(secondCall[0].root.tagName).toBe('SECTION')
    expect(firstController.unmount).toHaveBeenCalledTimes(1)
    expect(secondController.mount).toHaveBeenCalledTimes(1)
    expect(firstController.root).toBe(firstCall[0].root)
    expect(secondController.root).toBe(secondCall[0].root)

    unmount()

    expect(secondController.unmount).toHaveBeenCalledTimes(1)
  })
})
