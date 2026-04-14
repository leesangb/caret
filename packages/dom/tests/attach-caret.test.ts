import { createDocumentModel, createSelectionGeometry } from '@caret/core'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { attachCaret, createInvalidator } from '../src'

let rafSpy: ReturnType<typeof vi.spyOn> | undefined
let getContextSpy: ReturnType<typeof vi.spyOn> | undefined
const OriginalResizeObserver = globalThis.ResizeObserver

class MockResizeObserver implements ResizeObserver {
  static instances: MockResizeObserver[] = []

  readonly observe = vi.fn((target: Element) => {
    this.targets.add(target)
  })

  readonly unobserve = vi.fn((target: Element) => {
    this.targets.delete(target)
  })

  readonly disconnect = vi.fn(() => {
    this.targets.clear()
  })

  private readonly targets = new Set<Element>()

  constructor(private readonly callback: ResizeObserverCallback) {
    MockResizeObserver.instances.push(this)
  }

  notify(targets = [...this.targets]) {
    this.callback(
      targets.map((target) => ({
        target,
        contentRect: target.getBoundingClientRect()
      })) as ResizeObserverEntry[],
      this
    )
  }

  static reset() {
    MockResizeObserver.instances = []
  }
}

globalThis.ResizeObserver = MockResizeObserver as unknown as typeof ResizeObserver

function installMeasureMock() {
  const context = {
    font: '',
    measureText: (text: string) => ({ width: text.length * 10 })
  } as CanvasRenderingContext2D

  getContextSpy = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context)
}

function installRichMeasureMock() {
  const context = {
    font: '',
    measureText(text: string) {
      const sizeMatch = this.font.match(/(\d+(?:\.\d+)?)px/)
      const fontSize = sizeMatch === null ? 16 : Number.parseFloat(sizeMatch[1]!)

      return {
        width: Array.from(text).length * Math.max(8, fontSize * 0.56),
        actualBoundingBoxAscent: fontSize * 0.72,
        actualBoundingBoxDescent: fontSize * 0.28
      }
    }
  } as CanvasRenderingContext2D

  getContextSpy = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context)
}

function getGeometryOptions(root: HTMLElement) {
  const computed = window.getComputedStyle(root)
  const lineHeight = Number.parseFloat(computed.lineHeight || '') || 20
  const font = computed.font || '16px sans-serif'
  const paddingLeft = Number.parseFloat(computed.paddingLeft || '') || 0
  const paddingRight = Number.parseFloat(computed.paddingRight || '') || 0
  const rect = root.getBoundingClientRect()
  const blockWidth = Math.max(1, Math.round(rect.width - paddingLeft - paddingRight))

  return {
    blockWidth,
    lineHeight,
    font
  }
}

afterEach(() => {
  rafSpy?.mockRestore()
  rafSpy = undefined
  getContextSpy?.mockRestore()
  getContextSpy = undefined
  MockResizeObserver.reset()
  globalThis.ResizeObserver = OriginalResizeObserver ?? MockResizeObserver as unknown as typeof ResizeObserver
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

  it('offsets visuals by the rendered block position inside the root', () => {
    installMeasureMock()

    const root = document.createElement('div')
    root.style.padding = '18px 20px'
    root.innerHTML = '<p>Hello world</p>'
    document.body.appendChild(root)

    const paragraph = root.querySelector('p')
    if (!(paragraph instanceof HTMLElement)) {
      throw new Error('Expected paragraph element')
    }

    vi.spyOn(root, 'getBoundingClientRect').mockReturnValue({
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      right: 220,
      bottom: 100,
      width: 220,
      height: 100,
      toJSON() {
        return {}
      }
    } as DOMRect)
    vi.spyOn(paragraph, 'getBoundingClientRect').mockReturnValue({
      x: 20,
      y: 18,
      left: 20,
      top: 18,
      right: 130,
      bottom: 38,
      width: 110,
      height: 20,
      toJSON() {
        return {}
      }
    } as DOMRect)

    const render = vi.fn()
    const createRenderer = vi.fn((host: HTMLElement) => ({
      root: host.ownerDocument.createElement('div'),
      render,
      destroy: vi.fn()
    }))

    const caret = attachCaret({ root, createRenderer })
    caret.mount()
    caret.setCollapsedPosition({
      path: [0, 0],
      offset: 2
    })

    expect(render.mock.lastCall?.[0]?.visualState.caret).toEqual({
      x: 40,
      y: 18,
      height: 20
    })

    caret.unmount()
    root.remove()
  })

  it('does not double-count vertical offsets for later blocks', () => {
    installMeasureMock()

    const root = document.createElement('div')
    root.style.padding = '18px 20px'
    root.innerHTML = '<p>Hello world</p><p>Second line</p>'
    document.body.appendChild(root)

    const paragraphs = root.querySelectorAll('p')
    const firstParagraph = paragraphs[0]
    const secondParagraph = paragraphs[1]
    if (!(firstParagraph instanceof HTMLElement) || !(secondParagraph instanceof HTMLElement)) {
      throw new Error('Expected paragraph elements')
    }

    vi.spyOn(root, 'getBoundingClientRect').mockReturnValue({
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      right: 220,
      bottom: 160,
      width: 220,
      height: 160,
      toJSON() {
        return {}
      }
    } as DOMRect)
    vi.spyOn(firstParagraph, 'getBoundingClientRect').mockReturnValue({
      x: 20,
      y: 18,
      left: 20,
      top: 18,
      right: 130,
      bottom: 38,
      width: 110,
      height: 20,
      toJSON() {
        return {}
      }
    } as DOMRect)
    vi.spyOn(secondParagraph, 'getBoundingClientRect').mockReturnValue({
      x: 20,
      y: 72,
      left: 20,
      top: 72,
      right: 130,
      bottom: 92,
      width: 110,
      height: 20,
      toJSON() {
        return {}
      }
    } as DOMRect)

    const render = vi.fn()
    const createRenderer = vi.fn((host: HTMLElement) => ({
      root: host.ownerDocument.createElement('div'),
      render,
      destroy: vi.fn()
    }))

    const caret = attachCaret({ root, createRenderer })
    caret.mount()
    caret.setSelection({
      anchor: {
        path: [1, 0],
        offset: 0
      },
      focus: {
        path: [1, 0],
        offset: 6
      }
    })

    expect(render.mock.lastCall?.[0]?.visualState.selectionRects).toEqual([
      {
        x: 20,
        y: 72,
        width: 60,
        height: 20
      }
    ])

    caret.unmount()
    root.remove()
  })

  it('preserves pretext line insets when positioning mixed-font caret geometry', () => {
    installRichMeasureMock()

    const root = document.createElement('div')
    root.style.font = '16px sans-serif'
    root.style.lineHeight = '20px'
    root.style.padding = '18px 20px'
    root.innerHTML = [
      '<p style="line-height: 32px">',
      '<span style="font: 16px serif; line-height: 32px">Hello </span>',
      '<span style="font: 28px Georgia; line-height: 32px">World</span>',
      '</p>'
    ].join('')
    document.body.appendChild(root)

    const paragraph = root.querySelector('p')
    const text = root.querySelector('span')?.firstChild
    if (!(paragraph instanceof HTMLElement) || !(text instanceof Text)) {
      throw new Error('Expected paragraph and text node')
    }

    vi.spyOn(root, 'getBoundingClientRect').mockReturnValue({
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      right: 260,
      bottom: 120,
      width: 260,
      height: 120,
      toJSON() {
        return {}
      }
    } as DOMRect)
    vi.spyOn(paragraph, 'getBoundingClientRect').mockReturnValue({
      x: 20,
      y: 18,
      left: 20,
      top: 18,
      right: 220,
      bottom: 50,
      width: 200,
      height: 32,
      toJSON() {
        return {}
      }
    } as DOMRect)

    const render = vi.fn()
    const caret = attachCaret({
      root,
      createRenderer: (host) => ({
        root: host.ownerDocument.createElement('div'),
        render,
        destroy: vi.fn()
      })
    })

    const model = createDocumentModel(root)
    const geometry = createSelectionGeometry(model, getGeometryOptions(root))
    const localInset = geometry[0]!.rects[0]!.y - geometry[0]!.originY

    caret.mount()

    const selection = window.getSelection()
    if (selection === null) {
      throw new Error('Expected document selection')
    }

    const range = document.createRange()
    range.setStart(text, 1)
    range.setEnd(text, 1)
    selection.removeAllRanges()
    selection.addRange(range)
    document.dispatchEvent(new Event('selectionchange'))

    expect(render.mock.lastCall?.[0]?.visualState.caret).toEqual({
      x: expect.any(Number),
      y: 18 + localInset,
      height: geometry[0]!.rects[1]!.height
    })
    expect(localInset).toBeGreaterThan(0)

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

  it('refreshes when the root size changes without a window resize event', async () => {
    installMeasureMock()

    const root = document.createElement('div')
    root.innerHTML = '<p>Hello world</p>'
    document.body.appendChild(root)

    let width = 220
    vi.spyOn(root, 'getBoundingClientRect').mockImplementation(() => ({
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      right: width,
      bottom: 100,
      width,
      height: 100,
      toJSON() {
        return {}
      }
    } as DOMRect))

    const render = vi.fn()
    const caret = attachCaret({
      root,
      createRenderer: (host) => ({
        root: host.ownerDocument.createElement('div'),
        render,
        destroy: vi.fn()
      })
    })

    caret.mount()

    const resizeObserver = MockResizeObserver.instances[0]
    expect(resizeObserver).toBeDefined()
    expect(resizeObserver?.observe).toHaveBeenCalledWith(root)

    const initialRenderCount = render.mock.calls.length

    width = 140
    resizeObserver?.notify([root])

    await new Promise<void>((resolve) => {
      window.requestAnimationFrame(() => resolve())
    })

    expect(render.mock.calls.length).toBeGreaterThan(initialRenderCount)

    caret.unmount()
    root.remove()
  })

  it('disconnects the resize observer on unmount', () => {
    installMeasureMock()

    const root = document.createElement('div')
    root.innerHTML = '<p>Hello world</p>'
    document.body.appendChild(root)

    const caret = attachCaret({ root })
    caret.mount()

    const resizeObserver = MockResizeObserver.instances[0]
    expect(resizeObserver).toBeDefined()

    caret.unmount()

    expect(resizeObserver?.disconnect).toHaveBeenCalledTimes(1)

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
