import { afterEach, describe, expect, it, vi } from 'vitest'
import { attachCaret, createInvalidator } from '../src'

let rafSpy: ReturnType<typeof vi.spyOn> | undefined
let getContextSpy: ReturnType<typeof vi.spyOn> | undefined

function installMeasureMock() {
  const context = {
    font: '',
    measureText: (text: string) => ({ width: text.length * 10 })
  } as CanvasRenderingContext2D

  getContextSpy = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context)
}

afterEach(() => {
  rafSpy?.mockRestore()
  rafSpy = undefined
  getContextSpy?.mockRestore()
  getContextSpy = undefined
})

describe('attachCaret', () => {
  it('mounts an overlay and exposes the controller methods', () => {
    installMeasureMock()

    const root = document.createElement('div')
    root.innerHTML = '<p>Hello world</p>'
    document.body.appendChild(root)

    const caret = attachCaret({ root })
    caret.mount()

    expect(root.querySelector('[data-caret-overlay="true"]')).toBeInstanceOf(HTMLElement)
    expect(typeof caret.refresh).toBe('function')
    expect(typeof caret.getSelection).toBe('function')
    expect(typeof caret.setSelection).toBe('function')
    expect(typeof caret.setCollapsedPosition).toBe('function')
    expect(typeof caret.setSelectionFromDOM).toBe('function')
    expect(typeof caret.toDOMRange).toBe('function')
    expect(typeof caret.fromDOMRange).toBe('function')
    expect(typeof caret.hitTest).toBe('function')

    caret.unmount()
  })

  it('syncs selection from the DOM selection object', () => {
    installMeasureMock()

    const root = document.createElement('div')
    root.innerHTML = '<p>Hello <strong>world</strong></p>'
    document.body.appendChild(root)

    const caret = attachCaret({ root })
    caret.mount()

    const world = root.querySelector('strong')?.firstChild
    if (!(world instanceof Text)) {
      throw new Error('Expected text node inside strong element')
    }

    const range = document.createRange()
    range.setStart(world, 0)
    range.setEnd(world, 5)

    const selection = window.getSelection()
    if (selection === null) {
      throw new Error('Expected document selection')
    }

    selection.removeAllRanges()
    selection.addRange(range)
    document.dispatchEvent(new Event('selectionchange'))

    const synced = caret.getSelection()

    expect(synced?.anchor.offset).toBe(0)
    expect(synced?.focus.offset).toBe(5)

    caret.unmount()
  })

  it('batches invalidations with requestAnimationFrame', () => {
    const callbacks: FrameRequestCallback[] = []
    rafSpy = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      callbacks.push(callback)
      return callbacks.length
    })

    const invalidator = createInvalidator(vi.fn())
    invalidator.invalidate()
    invalidator.invalidate()
    invalidator.invalidate()

    expect(callbacks).toHaveLength(1)
    invalidator.cancel()
  })
})
