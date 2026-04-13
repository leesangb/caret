import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  createDocumentModel,
  createSelectionGeometry,
  deriveVisualState,
  fromDOMRange,
  type CaretSelection
} from '../src'

let getContextSpy: ReturnType<typeof vi.spyOn> | undefined

function installMeasureMock() {
  const context = {
    font: '',
    measureText: (text: string) => ({ width: text.length * 10 })
  } as CanvasRenderingContext2D

  getContextSpy = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context)
}

afterEach(() => {
  getContextSpy?.mockRestore()
  getContextSpy = undefined
})

function getSelection(root: HTMLElement, start: [Node, number], end: [Node, number]): CaretSelection {
  const model = createDocumentModel(root)
  const range = document.createRange()
  range.setStart(start[0], start[1])
  range.setEnd(end[0], end[1])
  return fromDOMRange(model, range)
}

describe('deriveVisualState', () => {
  it('returns a caret visual for collapsed selections', () => {
    installMeasureMock()

    const root = document.createElement('div')
    root.innerHTML = '<p>Hello</p>'

    const text = root.querySelector('p')?.firstChild
    if (!(text instanceof Text)) {
      throw new Error('Expected paragraph text node')
    }

    const model = createDocumentModel(root)
    const geometry = createSelectionGeometry(model, {
      blockWidth: 200,
      lineHeight: 20,
      font: '16px sans-serif',
      charWidth: 10
    })
    const selection = getSelection(root, [text, 2], [text, 2])
    const visualState = deriveVisualState(model, selection, geometry)

    expect(visualState.caret).toEqual({
      x: 20,
      y: 0,
      height: 20
    })
    expect(visualState.selectionRects).toEqual([])
  })

  it('returns a single selection rect for same-line ranges', () => {
    installMeasureMock()

    const root = document.createElement('div')
    root.innerHTML = '<p>Hello</p>'

    const text = root.querySelector('p')?.firstChild
    if (!(text instanceof Text)) {
      throw new Error('Expected paragraph text node')
    }

    const model = createDocumentModel(root)
    const geometry = createSelectionGeometry(model, {
      blockWidth: 200,
      lineHeight: 20,
      font: '16px sans-serif',
      charWidth: 10
    })
    const selection = getSelection(root, [text, 1], [text, 4])
    const visualState = deriveVisualState(model, selection, geometry)

    expect(visualState.caret).toBeNull()
    expect(visualState.selectionRects).toEqual([
      {
        x: 10,
        y: 0,
        width: 30,
        height: 20
      }
    ])
  })

  it('splits selection rects across wrapped lines', () => {
    installMeasureMock()

    const root = document.createElement('div')
    root.innerHTML = '<p>abcd</p>'

    const text = root.querySelector('p')?.firstChild
    if (!(text instanceof Text)) {
      throw new Error('Expected paragraph text node')
    }

    const model = createDocumentModel(root)
    const geometry = createSelectionGeometry(model, {
      blockWidth: 25,
      lineHeight: 20,
      font: '16px sans-serif',
      charWidth: 10
    })
    const selection = getSelection(root, [text, 1], [text, 4])
    const visualState = deriveVisualState(model, selection, geometry)

    expect(visualState.caret).toBeNull()
    expect(visualState.selectionRects).toEqual([
      {
        x: 10,
        y: 0,
        width: 10,
        height: 20
      },
      {
        x: 0,
        y: 20,
        width: 20,
        height: 20
      }
    ])
  })

  it('renders caret and selection visuals across inline-run boundaries', () => {
    installMeasureMock()

    const root = document.createElement('div')
    root.innerHTML = '<p>Hello <strong>world</strong></p>'

    const text = root.querySelector('p')?.childNodes[0]
    const paragraph = root.querySelector('p')
    const strongText = root.querySelector('strong')?.firstChild
    if (!(text instanceof Text) || !(paragraph instanceof HTMLElement) || !(strongText instanceof Text)) {
      throw new Error('Expected inline boundary text nodes')
    }

    const model = createDocumentModel(root)
    const geometry = createSelectionGeometry(model, {
      blockWidth: 200,
      lineHeight: 20,
      font: '16px sans-serif',
      charWidth: 10
    })

    const collapsed = getSelection(root, [text, 6], [text, 6])
    const collapsedVisuals = deriveVisualState(model, collapsed, geometry)

    expect(collapsedVisuals.caret).toEqual({
      x: 60,
      y: 0,
      height: 20
    })

    const ranged = getSelection(root, [text, 6], [strongText, 2])
    const rangedVisuals = deriveVisualState(model, ranged, geometry)

    expect(rangedVisuals.selectionRects).toEqual([
      {
        x: 60,
        y: 0,
        width: 20,
        height: 20
      }
    ])

    const containerCollapsed = getSelection(root, [paragraph, 1], [paragraph, 1])
    const containerCollapsedVisuals = deriveVisualState(model, containerCollapsed, geometry)

    expect(containerCollapsedVisuals.caret).toEqual({
      x: 60,
      y: 0,
      height: 20
    })

    const containerRanged = getSelection(root, [paragraph, 1], [paragraph, 2])
    const containerRangedVisuals = deriveVisualState(model, containerRanged, geometry)

    expect(containerRangedVisuals.selectionRects).toEqual([
      {
        x: 60,
        y: 0,
        width: 50,
        height: 20
      }
    ])
  })

  it('uses run-specific font metrics when inline runs have different fonts', () => {
    const context = {
      font: '',
      measureText(this: CanvasRenderingContext2D, text: string) {
        const unitWidth = this.font.includes('32px') ? 20 : 10
        return { width: text.length * unitWidth }
      }
    } as CanvasRenderingContext2D

    getContextSpy = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context)

    const root = document.createElement('div')
    root.innerHTML = '<p><span>Hi</span><span>!</span></p>'

    const text = root.querySelectorAll('span')
    const firstText = text[0]?.firstChild
    const secondText = text[1]?.firstChild
    if (!(firstText instanceof Text) || !(secondText instanceof Text)) {
      throw new Error('Expected span text nodes')
    }

    const model = createDocumentModel(root)
    ;(model.blocks[0].runs[0] as typeof model.blocks[0].runs[0] & { font: string }).font = '16px serif'
    ;(model.blocks[0].runs[1] as typeof model.blocks[0].runs[1] & { font: string }).font = '32px serif'

    const geometry = createSelectionGeometry(model, {
      blockWidth: 200,
      lineHeight: 24,
      font: '16px serif'
    })

    const selection = getSelection(root, [secondText, 1], [secondText, 1])
    const visualState = deriveVisualState(model, selection, geometry)

    expect(visualState.caret).toEqual({
      x: 40,
      y: 0,
      height: 24
    })
  })
})
