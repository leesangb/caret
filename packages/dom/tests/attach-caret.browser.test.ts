/// <reference types="@vitest/browser/providers/playwright" />
/// <reference types="@vitest/browser/matchers" />

import { afterEach, describe, expect, it } from 'vitest'
import { page } from 'vitest/browser'
import { attachCaret, type AttachCaretController, type OverlayRenderer } from '../src'

let controller: AttachCaretController | null = null

function createEditor(
  text: string,
  options: {
    dir?: 'ltr' | 'rtl'
    position?: string
  } = {}
) {
  const root = document.createElement('div')
  root.contentEditable = 'true'
  root.setAttribute('role', 'textbox')
  root.setAttribute('aria-label', 'Browser editor')
  root.style.position = options.position ?? 'relative'
  root.style.width = '420px'
  root.style.padding = '12px'
  root.style.border = '1px solid #ccc'
  root.style.font = '16px monospace'
  root.style.lineHeight = '20px'
  if (options.dir !== undefined) {
    root.dir = options.dir
  }
  root.innerHTML = `<p>${text}</p>`
  document.body.appendChild(root)
  return root
}

async function nextFrame(count = 2) {
  for (let index = 0; index < count; index += 1) {
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => resolve())
    })
  }
}

afterEach(() => {
  controller?.unmount()
  controller = null
  document.body.innerHTML = ''
  document.getSelection()?.removeAllRanges()
})

describe('attachCaret browser mode', () => {
  it('renders custom selection overlays from the live DOM selection', async () => {
    const root = createEditor('Try selecting this text in browser mode.')
    const text = root.querySelector('p')?.firstChild
    if (!(text instanceof Text)) {
      throw new Error('Expected paragraph text node')
    }

    controller = attachCaret({ root })
    controller.mount()

    await expect.element(page.getByRole('textbox', { name: 'Browser editor' })).toBeVisible()

    const range = document.createRange()
    range.setStart(text, 0)
    range.setEnd(text, 12)

    const selection = document.getSelection()
    if (selection === null) {
      throw new Error('Expected document selection')
    }

    selection.removeAllRanges()
    selection.addRange(range)

    await expect
      .poll(() => document.querySelectorAll('[data-caret-overlay-part="selection"]').length)
      .toBeGreaterThan(0)
  })

  it('suppresses native selection styling while mounted and restores it on unmount', async () => {
    const root = createEditor('Selection suppression should be scoped to the mounted root.')

    controller = attachCaret({ root })
    controller.mount()

    await expect
      .poll(() => root.hasAttribute('data-caret-selection-scope'))
      .toBe(true)
    expect(document.head.querySelector('[data-caret-selection-style]')).toBeInstanceOf(HTMLStyleElement)

    controller.unmount()
    controller = null

    expect(root.hasAttribute('data-caret-selection-scope')).toBe(false)
    expect(document.head.querySelector('[data-caret-selection-style]')).toBeNull()
  })

  it('uses a custom renderer factory without relying on test mocks', async () => {
    const root = createEditor('Custom renderer should control the overlay DOM.')

    function createRenderer(host: HTMLElement): OverlayRenderer {
      const overlay = host.ownerDocument.createElement('div')
      overlay.dataset.customRenderer = 'true'
      overlay.style.position = 'absolute'
      overlay.style.inset = '0'
      overlay.style.pointerEvents = 'none'

      return {
        root: overlay,
        render({ visualState }) {
          if (!overlay.parentNode) {
            host.appendChild(overlay)
          }

          overlay.replaceChildren()

          if (visualState.caret !== null) {
            const caret = host.ownerDocument.createElement('div')
            caret.dataset.customCaret = 'true'
            caret.style.position = 'absolute'
            caret.style.left = `${visualState.caret.x}px`
            caret.style.top = `${visualState.caret.y}px`
            caret.style.width = '2px'
            caret.style.height = `${visualState.caret.height}px`
            overlay.appendChild(caret)
          }
        },
        destroy() {
          overlay.remove()
        }
      }
    }

    controller = attachCaret({ root, createRenderer })
    controller.mount()
    controller.setCollapsedPosition({
      path: [0, 0],
      offset: 2
    })

    await expect
      .poll(() => root.querySelector('[data-custom-caret="true"]') instanceof HTMLElement)
      .toBe(true)
  })

  it('reflows selection overlays when the root width changes', async () => {
    const root = createEditor('The selection overlay should wrap into multiple rows after resize.')
    const text = root.querySelector('p')?.firstChild
    if (!(text instanceof Text)) {
      throw new Error('Expected paragraph text node')
    }

    controller = attachCaret({ root })
    controller.mount()
    controller.setSelection({
      anchor: {
        path: [0, 0],
        offset: 0
      },
      focus: {
        path: [0, 0],
        offset: text.data.length
      }
    })

    await expect
      .poll(() => document.querySelectorAll('[data-caret-overlay-part="selection"]').length)
      .toBeGreaterThan(0)
    const initialRectCount = document.querySelectorAll('[data-caret-overlay-part="selection"]').length

    root.style.width = '120px'
    await nextFrame()

    await expect
      .poll(() => document.querySelectorAll('[data-caret-overlay-part="selection"]').length)
      .toBeGreaterThan(initialRectCount)
  })

  it('falls back without mounting the overlay for rtl roots', () => {
    const root = createEditor('RTL roots should keep the native browser caret.', {
      dir: 'rtl'
    })

    controller = attachCaret({ root })
    controller.mount()

    expect(controller.supportState).toEqual({
      supported: false,
      reason: 'rtl-root'
    })
    expect(root.querySelector('[data-caret-overlay="true"]')).toBeNull()

    controller.setCollapsedPosition({
      path: [0, 0],
      offset: 0
    })

    expect(controller.getSelection()).toBeNull()
  })

  it('falls back when the root switches to rtl before mount', () => {
    const root = createEditor('Pre-mount rtl should never attach the overlay.')

    controller = attachCaret({ root })
    root.dir = 'rtl'

    expect(controller.supportState).toEqual({
      supported: false,
      reason: 'rtl-root'
    })

    controller.mount()

    expect(root.querySelector('[data-caret-overlay="true"]')).toBeNull()
    expect(controller.getSelection()).toBeNull()
  })

  it('tears down the overlay when the mounted root switches to rtl', async () => {
    const root = createEditor('Switching to rtl should disable the custom overlay.')

    controller = attachCaret({ root })
    controller.mount()

    await expect
      .poll(() => root.querySelector('[data-caret-overlay="true"]') instanceof HTMLElement)
      .toBe(true)

    root.dir = 'rtl'
    await nextFrame()

    expect(controller.supportState).toEqual({
      supported: false,
      reason: 'rtl-root'
    })
    expect(root.querySelector('[data-caret-overlay="true"]')).toBeNull()
    expect(root.hasAttribute('data-caret-selection-scope')).toBe(false)
  })

  it('promotes static roots to relative while mounted and restores them on unmount', async () => {
    const root = createEditor('Static roots need positioning for the overlay host.', {
      position: 'static'
    })

    controller = attachCaret({ root })
    controller.mount()

    await expect
      .poll(() => root.querySelector('[data-caret-overlay="true"]') instanceof HTMLElement)
      .toBe(true)

    expect(root.style.position).toBe('relative')

    controller.unmount()
    controller = null

    expect(root.style.position).toBe('static')
  })

  it('merges mixed inline selections into a single line rect in line mode', async () => {
    const root = createEditor('AAAA bb')
    root.style.font = '16px sans-serif'
    root.style.lineHeight = '32px'
    root.innerHTML = [
      '<p style="line-height: 32px">',
      '<span style="font: 32px serif; line-height: 32px">AAAA</span>',
      '<span style="font: 16px serif; line-height: 32px"> bb</span>',
      '</p>'
    ].join('')

    const firstText = root.querySelectorAll('span')[0]?.firstChild
    const secondText = root.querySelectorAll('span')[1]?.firstChild
    if (!(firstText instanceof Text) || !(secondText instanceof Text)) {
      throw new Error('Expected span text nodes')
    }

    controller = attachCaret({
      root,
      selection: {
        mergeStrategy: 'line'
      }
    })
    controller.mount()

    const selection = document.getSelection()
    if (selection === null) {
      throw new Error('Expected document selection')
    }

    const range = document.createRange()
    range.setStart(firstText, 0)
    range.setEnd(secondText, 3)
    selection.removeAllRanges()
    selection.addRange(range)

    await expect
      .poll(() => root.querySelectorAll('[data-caret-overlay-part="selection"]').length)
      .toBe(1)
  })

  it('maps inline-boundary DOM selections to the expected caret position', async () => {
    const root = createEditor('Hello world')
    root.innerHTML = '<p>Hello <strong>world</strong></p>'

    controller = attachCaret({ root })
    controller.mount()

    const paragraph = root.querySelector('p')
    if (!(paragraph instanceof HTMLElement)) {
      throw new Error('Expected paragraph element')
    }

    const selection = document.getSelection()
    if (selection === null) {
      throw new Error('Expected document selection')
    }

    const range = document.createRange()
    range.setStart(paragraph, 1)
    range.setEnd(paragraph, 1)
    selection.removeAllRanges()
    selection.addRange(range)

    await expect
      .poll(() => root.querySelectorAll('[data-caret-overlay-part="caret"]').length)
      .toBe(1)

    const caret = root.querySelector('[data-caret-overlay-part="caret"]')
    if (!(caret instanceof HTMLElement)) {
      throw new Error('Expected caret overlay')
    }

    expect(Number.parseFloat(caret.style.left)).toBeGreaterThan(0)
    expect(Number.parseFloat(caret.style.height)).toBeGreaterThan(0)
  })

  it('syncs controller selection state from the live DOM selection object', async () => {
    const root = createEditor('Hello world')
    root.innerHTML = '<p>Hello <strong>world</strong></p>'

    controller = attachCaret({ root })
    controller.mount()

    const world = root.querySelector('strong')?.firstChild
    if (!(world instanceof Text)) {
      throw new Error('Expected text node inside strong element')
    }

    const selection = document.getSelection()
    if (selection === null) {
      throw new Error('Expected document selection')
    }

    const range = document.createRange()
    range.setStart(world, 0)
    range.setEnd(world, 5)
    selection.removeAllRanges()
    selection.addRange(range)

    await expect
      .poll(() => controller?.getSelection()?.focus.offset ?? -1)
      .toBe(5)

    expect(controller?.getSelection()?.anchor.offset).toBe(0)
  })

  it('resyncs controller selection state after mutation-driven refreshes', async () => {
    const root = createEditor('Hello world')
    root.innerHTML = '<p>Hello <strong>world</strong></p>'

    controller = attachCaret({ root })
    controller.mount()

    const world = root.querySelector('strong')?.firstChild
    const paragraph = root.querySelector('p')
    if (!(world instanceof Text) || !(paragraph instanceof HTMLElement)) {
      throw new Error('Expected paragraph structure')
    }

    const selection = document.getSelection()
    if (selection === null) {
      throw new Error('Expected document selection')
    }

    const range = document.createRange()
    range.setStart(world, 0)
    range.setEnd(world, 5)
    selection.removeAllRanges()
    selection.addRange(range)

    const before = controller.setSelectionFromDOM()
    if (before === null) {
      throw new Error('Expected controller selection')
    }

    paragraph.insertBefore(document.createTextNode('lead '), paragraph.firstChild)
    await nextFrame()

    await expect
      .poll(() => JSON.stringify(controller?.getSelection()))
      .toBe(JSON.stringify(controller.fromDOMRange(selection.getRangeAt(0))))
  })

  it('tears down the overlay when an ancestor switches to rtl after mount', async () => {
    const wrapper = document.createElement('div')
    document.body.appendChild(wrapper)

    const root = createEditor('Ancestor rtl should also disable the overlay.')
    wrapper.appendChild(root)

    controller = attachCaret({ root })
    controller.mount()

    await expect
      .poll(() => root.querySelector('[data-caret-overlay="true"]') instanceof HTMLElement)
      .toBe(true)

    wrapper.dir = 'rtl'
    await nextFrame()

    expect(controller.supportState).toEqual({
      supported: false,
      reason: 'rtl-root'
    })
    expect(root.querySelector('[data-caret-overlay="true"]')).toBeNull()
  })
})
