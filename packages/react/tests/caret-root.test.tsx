import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

const { attachCaretMock, mountMock, unmountMock } = vi.hoisted(() => {
  const mountMock = vi.fn()
  const unmountMock = vi.fn()
  const attachCaretMock = vi.fn(() => ({
    mount: mountMock,
    unmount: unmountMock
  }))

  return {
    attachCaretMock,
    mountMock,
    unmountMock
  }
})

vi.mock('@caret/dom', () => ({
  attachCaret: attachCaretMock
}))

import { CaretRoot } from '../src'

describe('CaretRoot', () => {
  it('renders its child and mounts the DOM controller', () => {
    const { unmount } = render(
      <CaretRoot>
        <div>Hello</div>
      </CaretRoot>
    )

    const child = screen.getByText('Hello')

    expect(child).toBeInstanceOf(HTMLElement)
    expect(attachCaretMock).toHaveBeenCalledWith({ root: child })
    expect(mountMock).toHaveBeenCalledTimes(1)

    unmount()

    expect(unmountMock).toHaveBeenCalledTimes(1)
  })
})
