import { afterEach, describe, expect, it, vi } from 'vitest'
import { createDocumentModel } from '../src/model/normalize-root'
import { createSelectionGeometry } from '../src/geometry/selection-geometry'
import { hitTest } from '../src/hit-test/hit-test'

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

describe('selection geometry and hit testing', () => {
  it('maps x coordinates into text offsets for a single block', () => {
    installMeasureMock()

    const root = document.createElement('div')
    root.innerHTML = '<p>Hello world</p>'
    const model = createDocumentModel(root)

    const boxes = createSelectionGeometry(model, {
      blockWidth: 220,
      lineHeight: 20,
      font: '16px sans-serif'
    })

    const hit = hitTest(model, boxes, { x: 54, y: 10 })

    expect(boxes[0].rects.length).toBeGreaterThan(0)
    expect(hit?.offset).toBe(5)
  })

  it('returns offset 0 for an empty block', () => {
    installMeasureMock()

    const root = document.createElement('div')
    root.innerHTML = '<p></p>'
    const model = createDocumentModel(root)

    const boxes = createSelectionGeometry(model, {
      blockWidth: 200,
      lineHeight: 20,
      font: '16px sans-serif'
    })

    const hit = hitTest(model, boxes, { x: 200, y: 20 })

    expect(hit?.offset).toBe(0)
  })

  it('returns the end of the line when clicking after the last character', () => {
    installMeasureMock()

    const root = document.createElement('div')
    root.innerHTML = '<p>Hello world</p>'
    const model = createDocumentModel(root)

    const boxes = createSelectionGeometry(model, {
      blockWidth: 60,
      lineHeight: 20,
      font: '16px sans-serif'
    })

    const lineEndZone = boxes[0].rects
      .filter((rect) => rect.lineIndex === 0)
      .reduce((max, rect) => Math.max(max, rect.caretOffset), 0)

    const hit = hitTest(model, boxes, { x: 60, y: 10 })

    expect(hit?.offset).toBe(lineEndZone)
  })

  it('wraps text according to pretext line breaks', () => {
    installMeasureMock()

    const root = document.createElement('div')
    root.innerHTML = '<p>Hello world from pretext</p>'
    const model = createDocumentModel(root)

    const wideBoxes = createSelectionGeometry(model, {
      blockWidth: 260,
      lineHeight: 20,
      font: '16px sans-serif'
    })
    const narrowBoxes = createSelectionGeometry(model, {
      blockWidth: 60,
      lineHeight: 20,
      font: '16px sans-serif'
    })

    const wideLineCount = new Set(wideBoxes[0].rects.map((rect) => rect.y)).size
    const narrowLineCount = new Set(narrowBoxes[0].rects.map((rect) => rect.y)).size

    expect(narrowLineCount).toBeGreaterThan(wideLineCount)
    expect(hitTest(model, wideBoxes, { x: 5, y: 30 })).toBeNull()
    expect(hitTest(model, narrowBoxes, { x: 5, y: 30 })?.offset).toBeGreaterThan(0)
  })

  it('preserves plain-text caret geometry when block spacing is applied', () => {
    installMeasureMock()

    const root = document.createElement('div')
    root.innerHTML = '<p>A B</p>'
    const model = createDocumentModel(root)

    ;(model.blocks[0].letterSpacing as number | undefined) = 2
    ;(model.blocks[0].wordSpacing as number | undefined) = 5

    const boxes = createSelectionGeometry(model, {
      blockWidth: 200,
      lineHeight: 20,
      font: '16px sans-serif'
    })

    expect(boxes[0]?.rects.map((rect) => rect.caretX)).toEqual([0, 12, 29, 39])
    expect(hitTest(model, boxes, { x: 24, y: 10 })?.offset).toBe(2)
  })

  it('handles non-BMP text without breaking caret geometry', () => {
    installMeasureMock()

    const root = document.createElement('div')
    root.innerHTML = '<p>A😀B</p>'
    const model = createDocumentModel(root)

    const boxes = createSelectionGeometry(model, {
      blockWidth: 200,
      lineHeight: 20,
      font: '16px sans-serif'
    })

    const hit = hitTest(model, boxes, { x: 22, y: 10 })

    expect(boxes[0].rects.every((rect) => Number.isFinite(rect.x) && Number.isFinite(rect.width))).toBe(true)
    expect(hit?.offset).toBe(3)
  })

  it('uses per-line rich inline heights when mixed runs wrap', () => {
    installMeasureMock()

    const root = document.createElement('div')
    root.innerHTML = '<p><span>AA</span><span>B</span><span>CC</span></p>'
    const model = createDocumentModel(root)

    model.blocks[0]!.runs[0]!.font = '16px serif'
    model.blocks[0]!.runs[0]!.lineHeight = 20
    model.blocks[0]!.runs[1]!.font = '32px serif'
    model.blocks[0]!.runs[1]!.lineHeight = 32
    model.blocks[0]!.runs[2]!.font = '16px serif'
    model.blocks[0]!.runs[2]!.lineHeight = 20

    const boxes = createSelectionGeometry(model, {
      blockWidth: 45,
      lineHeight: 20,
      font: '16px serif'
    })

    const lineTops = [...new Set(boxes[0].rects.map((rect) => rect.y))]

    expect(lineTops).toEqual([0, 32])
  })
})
