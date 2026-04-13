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
    root.remove()
  })

  it('falls back without mounting the overlay for rtl roots', () => {
    installMeasureMock()

    const root = document.createElement('div')
    root.dir = 'rtl'
    root.innerHTML = '<p>Hello world</p>'
    document.body.appendChild(root)

    const caret = attachCaret({ root })
    caret.mount()

    expect(caret.supportState).toEqual({
      supported: false,
      reason: 'rtl-root'
    })
    expect(root.querySelector('[data-caret-overlay="true"]')).toBeNull()

    caret.setCollapsedPosition({
      path: [0, 0],
      offset: 0
    })
    expect(caret.getSelection()).toBeNull()

    caret.unmount()
    root.remove()
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
    root.remove()
  })

  it('preserves backward selection direction through the fallback DOM sync path', () => {
    installMeasureMock()

    const root = document.createElement('div')
    root.innerHTML = '<p>Hello world</p>'
    document.body.appendChild(root)

    const caret = attachCaret({ root })
    caret.mount()

    const text = root.querySelector('p')?.firstChild
    if (!(text instanceof Text)) {
      throw new Error('Expected text node inside paragraph')
    }

    const selection = window.getSelection()
    if (selection === null) {
      throw new Error('Expected document selection')
    }

    const originalSetBaseAndExtent = (selection as Selection & { setBaseAndExtent?: unknown }).setBaseAndExtent
    try {
      Object.defineProperty(selection, 'setBaseAndExtent', {
        configurable: true,
        value: undefined
      })

      if (typeof selection.collapse !== 'function' || typeof selection.extend !== 'function') {
        caret.unmount()
        root.remove()
        return
      }

      selection.collapse(text, 0)
      selection.extend(text, 5)
      const forward = caret.setSelectionFromDOM()
      if (forward === null) {
        throw new Error('Expected forward selection')
      }

      const backward = {
        anchor: forward.focus,
        focus: forward.anchor
      }

      caret.setSelection(backward)

      expect(caret.getSelection()).toEqual(backward)
      expect(selection.anchorOffset).toBe(5)
      expect(selection.focusOffset).toBe(0)
    } finally {
      Object.defineProperty(selection, 'setBaseAndExtent', {
        configurable: true,
        value: originalSetBaseAndExtent
      })
    }

    caret.unmount()
    root.remove()
  })

  it('keeps overlay content out of post-mount refresh snapshots', () => {
    installMeasureMock()

    const root = document.createElement('div')
    root.innerHTML = '<p>Hello</p>'
    document.body.appendChild(root)

    const caret = attachCaret({ root })
    caret.mount()

    const overlay = root.querySelector('[data-caret-overlay="true"]')
    if (!(overlay instanceof HTMLElement)) {
      throw new Error('Expected overlay root to be mounted')
    }

    overlay.appendChild(document.createTextNode('overlay noise'))
    caret.refresh()

    expect(caret.hitTest({ x: 5, y: 30 })).toBeNull()

    caret.unmount()
    root.remove()
  })

  it('resyncs selection state after mutation-driven snapshot refresh', async () => {
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

    const selection = window.getSelection()
    if (selection === null) {
      throw new Error('Expected document selection')
    }

    const range = document.createRange()
    range.setStart(world, 0)
    range.setEnd(world, 5)
    selection.removeAllRanges()
    selection.addRange(range)

    const before = caret.setSelectionFromDOM()
    if (before === null) {
      throw new Error('Expected controller selection')
    }

    const paragraph = root.querySelector('p')
    if (!(paragraph instanceof HTMLElement)) {
      throw new Error('Expected paragraph element')
    }

    paragraph.insertBefore(document.createTextNode('lead '), paragraph.firstChild)

    await new Promise<void>((resolve) => {
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => resolve())
      })
    })

    expect(caret.getSelection()).toEqual(caret.fromDOMRange(selection.getRangeAt(0)))

    caret.unmount()
    root.remove()
  })

  it('settles a mutation-triggered refresh without rescheduling from overlay writes', () => {
    installMeasureMock()

    const rafCallbacks: FrameRequestCallback[] = []
    rafSpy = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      rafCallbacks.push(callback)
      return rafCallbacks.length
    })

    type FakeObserverInstance = MutationObserver & {
      callback: MutationCallback
      target: Node | null
    }
    const activeObservers = new Set<FakeObserverInstance>()

    class FakeMutationObserver implements MutationObserver {
      readonly callback: MutationCallback
      readonly disconnect: () => void
      readonly observe: MutationObserver['observe']
      readonly takeRecords: MutationObserver['takeRecords']
      target: Node | null = null

      constructor(callback: MutationCallback) {
        this.callback = callback
        this.disconnect = () => {
          activeObservers.delete(this)
          this.target = null
        }
        this.observe = (target: Node) => {
          this.target = target
          activeObservers.add(this)
        }
        this.takeRecords = () => []
      }
    }

    const notifyObservers = (target: Node) => {
      for (const observer of activeObservers) {
        const observedTarget = observer.target
        if (observedTarget !== null && (observedTarget === target || observedTarget.contains(target))) {
          observer.callback([], observer)
        }
      }
    }

    const patchMutationMethod = <T extends object, K extends keyof T>(
      prototype: T,
      method: K,
      notifyBefore = false
    ) => {
      const original = prototype[method]
      ;(prototype as T & Record<K, (...args: never[]) => unknown>)[method] = function (...args: never[]) {
        if (notifyBefore) {
          notifyObservers(this as unknown as Node)
        }

        const result = Reflect.apply(original as (...params: never[]) => unknown, this, args)

        if (!notifyBefore) {
          notifyObservers(this as unknown as Node)
        }

        return result
      }

      return () => {
        ;(prototype as T & Record<K, (...args: never[]) => unknown>)[method] = original
      }
    }

    const restoreMutationMethods = [
      patchMutationMethod(Node.prototype, 'appendChild'),
      patchMutationMethod(Node.prototype, 'insertBefore'),
      patchMutationMethod(Node.prototype, 'removeChild', true),
      patchMutationMethod(Element.prototype, 'replaceChildren')
    ]

    vi.stubGlobal('MutationObserver', FakeMutationObserver as unknown as typeof MutationObserver)

    let root: HTMLDivElement | null = null
    let caret: ReturnType<typeof attachCaret> | null = null

    try {
      root = document.createElement('div')
      root.innerHTML = '<p>Hello <strong>world</strong></p>'
      document.body.appendChild(root)

      caret = attachCaret({ root })
      caret.mount()

      const paragraph = root.querySelector('p')
      if (!(paragraph instanceof HTMLElement)) {
        throw new Error('Expected paragraph element')
      }

      paragraph.appendChild(document.createTextNode('!'))

      expect(rafCallbacks).toHaveLength(1)

      const flushRafs = (limit = 8) => {
        let executed = 0

        while (executed < limit && rafCallbacks.length > 0) {
          const callback = rafCallbacks.shift()
          if (callback === undefined) break

          callback(performance.now())
          executed += 1
        }

        return executed
      }

      expect(flushRafs()).toBe(1)
      expect(rafCallbacks).toHaveLength(0)

      caret.unmount()
      root.remove()
    } finally {
      caret?.unmount()
      root?.remove()

      for (const restore of restoreMutationMethods) {
        restore()
      }

      vi.unstubAllGlobals()
    }
  })

  it('forces a relative host when inline position is static', () => {
    installMeasureMock()

    const root = document.createElement('div')
    root.style.position = 'static'
    root.innerHTML = '<p>Hello world</p>'
    document.body.appendChild(root)

    const caret = attachCaret({ root })
    caret.mount()

    expect(root.style.position).toBe('relative')
    expect(root.querySelector('[data-caret-overlay="true"]')).toBeInstanceOf(HTMLElement)

    caret.unmount()

    expect(root.style.position).toBe('static')
    root.remove()
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
