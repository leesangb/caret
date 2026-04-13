import { describe, expect, it } from 'vitest'
import { createDocumentModel } from '../src/model/normalize-root'
import { createSelectionGeometry } from '../src/geometry/selection-geometry'
import { hitTest } from '../src/hit-test/hit-test'

describe('selection geometry and hit testing', () => {
  it('maps x coordinates into text offsets for a single block', () => {
    const root = document.createElement('div')
    root.innerHTML = '<p>Hello world</p>'
    const model = createDocumentModel(root)

    const boxes = createSelectionGeometry(model, {
      blockWidth: 220,
      charWidth: 10,
      lineHeight: 20
    })

    const hit = hitTest(model, boxes, { x: 55, y: 10 })

    expect(boxes[0].rects[0].width).toBeGreaterThan(0)
    expect(hit?.offset).toBe(5)
  })
})
