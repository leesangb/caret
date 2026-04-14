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
      x: 60,
      y: 0,
      height: 24
    })
  })

  it('prefers font bounding metrics for mixed inline caret height when available', () => {
    const context = {
      font: '',
      measureText(this: CanvasRenderingContext2D, text: string) {
        const unitWidth = this.font.includes('32px') ? 20 : 10

        return {
          width: text.length * unitWidth,
          fontBoundingBoxAscent: 18,
          fontBoundingBoxDescent: 8,
          actualBoundingBoxAscent: 12,
          actualBoundingBoxDescent: 4
        }
      }
    } as CanvasRenderingContext2D

    getContextSpy = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context)

    const root = document.createElement('div')
    root.innerHTML = '<p><span>Hi</span><span>!</span></p>'

    const text = root.querySelectorAll('span')
    const secondText = text[1]?.firstChild
    if (!(secondText instanceof Text)) {
      throw new Error('Expected span text nodes')
    }

    const model = createDocumentModel(root)
    ;(model.blocks[0].runs[0] as typeof model.blocks[0].runs[0] & { font: string; lineHeight: number }).font = '16px serif'
    ;(model.blocks[0].runs[0] as typeof model.blocks[0].runs[0] & { font: string; lineHeight: number }).lineHeight = 32
    ;(model.blocks[0].runs[1] as typeof model.blocks[0].runs[1] & { font: string; lineHeight: number }).font = '32px serif'
    ;(model.blocks[0].runs[1] as typeof model.blocks[0].runs[1] & { font: string; lineHeight: number }).lineHeight = 32

    const geometry = createSelectionGeometry(model, {
      blockWidth: 200,
      lineHeight: 24,
      font: '16px serif'
    })

    const selection = getSelection(root, [secondText, 1], [secondText, 1])
    const visualState = deriveVisualState(model, selection, geometry)

    expect(visualState.caret).toEqual({
      x: 60,
      y: 3,
      height: 26
    })
  })

  it('applies letter spacing to mixed-inline selection widths', () => {
    const context = {
      font: '',
      measureText(this: CanvasRenderingContext2D, text: string) {
        return {
          width: text.length * 10,
          fontBoundingBoxAscent: 14,
          fontBoundingBoxDescent: 6,
          actualBoundingBoxAscent: 12,
          actualBoundingBoxDescent: 4
        }
      }
    } as CanvasRenderingContext2D

    getContextSpy = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context)

    const root = document.createElement('div')
    root.innerHTML = '<p><span>Big beats</span><span> tail</span></p>'

    const text = root.querySelectorAll('span')
    const firstText = text[0]?.firstChild
    if (!(firstText instanceof Text)) {
      throw new Error('Expected span text nodes')
    }

    const model = createDocumentModel(root)
    ;(model.blocks[0].font as string | undefined) = '16px sans-serif'
    ;(model.blocks[0].lineHeight as number | undefined) = 20
    ;(model.blocks[0].runs[0] as typeof model.blocks[0].runs[0] & { font: string; lineHeight: number; letterSpacing: number }).font = '32px sans-serif'
    ;(model.blocks[0].runs[0] as typeof model.blocks[0].runs[0] & { font: string; lineHeight: number; letterSpacing: number }).lineHeight = 28
    ;(model.blocks[0].runs[0] as typeof model.blocks[0].runs[0] & { font: string; lineHeight: number; letterSpacing: number }).letterSpacing = -0.75
    ;(model.blocks[0].runs[1] as typeof model.blocks[0].runs[1] & { font: string; lineHeight: number }).font = '16px sans-serif'
    ;(model.blocks[0].runs[1] as typeof model.blocks[0].runs[1] & { font: string; lineHeight: number }).lineHeight = 20

    const geometry = createSelectionGeometry(model, {
      blockWidth: 400,
      lineHeight: 20,
      font: '16px sans-serif'
    })

    const selection = getSelection(root, [firstText, 0], [firstText, 9])
    const visualState = deriveVisualState(model, selection, geometry)

    expect(visualState.selectionRects).toEqual([
      {
        x: 0,
        y: 4,
        width: 84,
        height: 20
      }
    ])
  })

  it('offsets mixed-inline selection geometry by inline start and end chrome', () => {
    const context = {
      font: '',
      measureText(text: string) {
        return {
          width: text.length * 10,
          fontBoundingBoxAscent: 14,
          fontBoundingBoxDescent: 6,
          actualBoundingBoxAscent: 12,
          actualBoundingBoxDescent: 4
        }
      }
    } as CanvasRenderingContext2D

    getContextSpy = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context)

    const root = document.createElement('div')
    root.innerHTML = '<p><span>mono</span><span> tail</span></p>'

    const text = root.querySelectorAll('span')
    const firstText = text[0]?.firstChild
    if (!(firstText instanceof Text)) {
      throw new Error('Expected span text nodes')
    }

    const model = createDocumentModel(root)
    ;(model.blocks[0].font as string | undefined) = '16px sans-serif'
    ;(model.blocks[0].runs[0] as typeof model.blocks[0].runs[0] & { font: string; inlineStartInset: number; inlineEndInset: number }).font = '16px monospace'
    ;(model.blocks[0].runs[0] as typeof model.blocks[0].runs[0] & { font: string; inlineStartInset: number; inlineEndInset: number }).inlineStartInset = 3
    ;(model.blocks[0].runs[0] as typeof model.blocks[0].runs[0] & { font: string; inlineStartInset: number; inlineEndInset: number }).inlineEndInset = 3
    ;(model.blocks[0].runs[1] as typeof model.blocks[0].runs[1] & { font: string }).font = '16px sans-serif'

    const geometry = createSelectionGeometry(model, {
      blockWidth: 400,
      lineHeight: 20,
      font: '16px sans-serif'
    })

    const selection = getSelection(root, [firstText, 0], [firstText, 4])
    const visualState = deriveVisualState(model, selection, geometry)

    expect(visualState.selectionRects).toEqual([
      {
        x: 3,
        y: 0,
        width: 40,
        height: 20
      }
    ])
  })

  it('does not paint inline end chrome as selected width when the next fragment continues on the same line', () => {
    const context = {
      font: '',
      measureText(text: string) {
        return {
          width: text.length * 10,
          fontBoundingBoxAscent: 14,
          fontBoundingBoxDescent: 6,
          actualBoundingBoxAscent: 12,
          actualBoundingBoxDescent: 4
        }
      }
    } as CanvasRenderingContext2D

    getContextSpy = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context)

    const root = document.createElement('div')
    root.innerHTML = '<p><span>mono</span><span>tail</span></p>'

    const text = root.querySelectorAll('span')
    const firstText = text[0]?.firstChild
    const secondText = text[1]?.firstChild
    if (!(firstText instanceof Text) || !(secondText instanceof Text)) {
      throw new Error('Expected span text nodes')
    }

    const model = createDocumentModel(root)
    ;(model.blocks[0].font as string | undefined) = '16px sans-serif'
    ;(model.blocks[0].runs[0] as typeof model.blocks[0].runs[0] & { font: string; inlineStartInset: number; inlineEndInset: number }).font = '16px monospace'
    ;(model.blocks[0].runs[0] as typeof model.blocks[0].runs[0] & { font: string; inlineStartInset: number; inlineEndInset: number }).inlineStartInset = 3
    ;(model.blocks[0].runs[0] as typeof model.blocks[0].runs[0] & { font: string; inlineStartInset: number; inlineEndInset: number }).inlineEndInset = 3
    ;(model.blocks[0].runs[1] as typeof model.blocks[0].runs[1] & { font: string }).font = '16px sans-serif'

    const geometry = createSelectionGeometry(model, {
      blockWidth: 400,
      lineHeight: 20,
      font: '16px sans-serif'
    })

    const selection = getSelection(root, [firstText, 0], [secondText, 1])
    const visualState = deriveVisualState(model, selection, geometry)

    expect(visualState.selectionRects).toEqual([
      {
        x: 3,
        y: 0,
        width: 40,
        height: 20
      },
      {
        x: 46,
        y: 0,
        width: 10,
        height: 20
      }
    ])
  })

  it('splits same-line selection rects when mixed inline runs have different vertical boxes', () => {
    const context = {
      font: '',
      measureText(this: CanvasRenderingContext2D, text: string) {
        const isLarge = this.font.includes('32px')
        return {
          width: text.length * (isLarge ? 10 : 8),
          fontBoundingBoxAscent: isLarge ? 18 : 12,
          fontBoundingBoxDescent: isLarge ? 10 : 4,
          actualBoundingBoxAscent: isLarge ? 18 : 12,
          actualBoundingBoxDescent: isLarge ? 10 : 4
        }
      }
    } as CanvasRenderingContext2D

    getContextSpy = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context)

    const root = document.createElement('div')
    root.innerHTML = '<p><span>AAAA</span><span> bb</span></p>'

    const text = root.querySelectorAll('span')
    const firstText = text[0]?.firstChild
    const secondText = text[1]?.firstChild
    if (!(firstText instanceof Text) || !(secondText instanceof Text)) {
      throw new Error('Expected span text nodes')
    }

    const model = createDocumentModel(root)
    ;(model.blocks[0].font as string | undefined) = '16px sans-serif'
    ;(model.blocks[0].lineHeight as number | undefined) = 20
    ;(model.blocks[0].runs[0] as typeof model.blocks[0].runs[0] & { font: string; lineHeight: number }).font = '32px sans-serif'
    ;(model.blocks[0].runs[0] as typeof model.blocks[0].runs[0] & { font: string; lineHeight: number }).lineHeight = 28
    ;(model.blocks[0].runs[1] as typeof model.blocks[0].runs[1] & { font: string; lineHeight: number }).font = '16px sans-serif'
    ;(model.blocks[0].runs[1] as typeof model.blocks[0].runs[1] & { font: string; lineHeight: number }).lineHeight = 20

    const geometry = createSelectionGeometry(model, {
      blockWidth: 400,
      lineHeight: 20,
      font: '16px sans-serif'
    })

    const selection = getSelection(root, [firstText, 0], [secondText, 3])
    const visualState = deriveVisualState(model, selection, geometry)

    expect(visualState.selectionRects).toEqual([
      {
        x: 0,
        y: 0,
        width: 32,
        height: 28
      },
      {
        x: 32,
        y: 6,
        width: 26,
        height: 16
      }
    ])
  })

  it('aligns mixed inline fragments to a shared baseline instead of centering each fragment', () => {
    const context = {
      font: '',
      measureText(this: CanvasRenderingContext2D, text: string) {
        const isLarge = this.font.includes('32px')
        return {
          width: text.length * 10,
          fontBoundingBoxAscent: isLarge ? 20 : 8,
          fontBoundingBoxDescent: isLarge ? 4 : 8,
          actualBoundingBoxAscent: isLarge ? 20 : 8,
          actualBoundingBoxDescent: isLarge ? 4 : 8
        }
      }
    } as CanvasRenderingContext2D

    getContextSpy = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context)

    const root = document.createElement('div')
    root.innerHTML = '<p><span>AAAA</span><span> bb</span></p>'

    const text = root.querySelectorAll('span')
    const firstText = text[0]?.firstChild
    const secondText = text[1]?.firstChild
    if (!(firstText instanceof Text) || !(secondText instanceof Text)) {
      throw new Error('Expected span text nodes')
    }

    const model = createDocumentModel(root)
    ;(model.blocks[0].font as string | undefined) = '16px sans-serif'
    ;(model.blocks[0].lineHeight as number | undefined) = 32
    ;(model.blocks[0].runs[0] as typeof model.blocks[0].runs[0] & { font: string; lineHeight: number }).font = '32px sans-serif'
    ;(model.blocks[0].runs[0] as typeof model.blocks[0].runs[0] & { font: string; lineHeight: number }).lineHeight = 32
    ;(model.blocks[0].runs[1] as typeof model.blocks[0].runs[1] & { font: string; lineHeight: number }).font = '16px sans-serif'
    ;(model.blocks[0].runs[1] as typeof model.blocks[0].runs[1] & { font: string; lineHeight: number }).lineHeight = 32

    const geometry = createSelectionGeometry(model, {
      blockWidth: 400,
      lineHeight: 32,
      font: '16px sans-serif'
    })

    const selection = getSelection(root, [firstText, 0], [secondText, 3])
    const visualState = deriveVisualState(model, selection, geometry)

    expect(visualState.selectionRects).toEqual([
      {
        x: 0,
        y: 2,
        width: 40,
        height: 24
      },
      {
        x: 40,
        y: 14,
        width: 30,
        height: 16
      }
    ])
  })

  it('can merge same-line mixed fragments into one line-sized selection rect', () => {
    const context = {
      font: '',
      measureText(this: CanvasRenderingContext2D, text: string) {
        const isLarge = this.font.includes('32px')
        return {
          width: text.length * 10,
          fontBoundingBoxAscent: isLarge ? 20 : 8,
          fontBoundingBoxDescent: isLarge ? 4 : 8,
          actualBoundingBoxAscent: isLarge ? 20 : 8,
          actualBoundingBoxDescent: isLarge ? 4 : 8
        }
      }
    } as CanvasRenderingContext2D

    getContextSpy = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context)

    const root = document.createElement('div')
    root.innerHTML = '<p><span>AAAA</span><span> bb</span></p>'

    const text = root.querySelectorAll('span')
    const firstText = text[0]?.firstChild
    const secondText = text[1]?.firstChild
    if (!(firstText instanceof Text) || !(secondText instanceof Text)) {
      throw new Error('Expected span text nodes')
    }

    const model = createDocumentModel(root)
    ;(model.blocks[0].font as string | undefined) = '16px sans-serif'
    ;(model.blocks[0].lineHeight as number | undefined) = 32
    ;(model.blocks[0].runs[0] as typeof model.blocks[0].runs[0] & { font: string; lineHeight: number }).font = '32px sans-serif'
    ;(model.blocks[0].runs[0] as typeof model.blocks[0].runs[0] & { font: string; lineHeight: number }).lineHeight = 32
    ;(model.blocks[0].runs[1] as typeof model.blocks[0].runs[1] & { font: string; lineHeight: number }).font = '16px sans-serif'
    ;(model.blocks[0].runs[1] as typeof model.blocks[0].runs[1] & { font: string; lineHeight: number }).lineHeight = 32

    const geometry = createSelectionGeometry(model, {
      blockWidth: 400,
      lineHeight: 32,
      font: '16px sans-serif'
    })

    const selection = getSelection(root, [firstText, 0], [secondText, 3])
    const visualState = deriveVisualState(model, selection, geometry, {
      selection: {
        mergeStrategy: 'line'
      }
    })

    expect(visualState.selectionRects).toEqual([
      {
        x: 0,
        y: 2,
        width: 70,
        height: 28
      }
    ])
  })

  it('keeps the last selection rect when the range ends inside an emoji surrogate pair', () => {
    installMeasureMock()

    const root = document.createElement('div')
    root.innerHTML = '<p>ABCD😄</p>'

    const text = root.querySelector('p')?.firstChild
    if (!(text instanceof Text)) {
      throw new Error('Expected paragraph text node')
    }

    const model = createDocumentModel(root)
    const geometry = createSelectionGeometry(model, {
      blockWidth: 35,
      lineHeight: 20,
      font: '16px sans-serif',
      charWidth: 10
    })

    const selection = getSelection(root, [text, 0], [text, 5])
    const visualState = deriveVisualState(model, selection, geometry)

    expect(visualState.selectionRects.length).toBeGreaterThan(1)
    expect(visualState.selectionRects.at(-1)).toEqual({
      x: 0,
      y: 20,
      width: 30,
      height: 20
    })
  })
})
