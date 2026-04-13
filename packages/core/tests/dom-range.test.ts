import { describe, expect, it } from 'vitest'
import { createDocumentModel, fromDOMRange, toDOMRange } from '../src'

describe('DOM range conversions', () => {
  it('round-trips a text-node selection through nested inline content', () => {
    const root = document.createElement('div')
    root.innerHTML = '<p>Hello <strong>world</strong></p>'
    const model = createDocumentModel(root)

    const worldText = root.querySelector('strong')?.firstChild
    if (!(worldText instanceof Text)) {
      throw new Error('Expected text node inside strong element')
    }

    const range = document.createRange()
    range.setStart(worldText, 0)
    range.setEnd(worldText, 5)

    const selection = fromDOMRange(model, range)
    const roundTrip = toDOMRange(model, selection)

    expect(selection.anchor.path).toEqual(selection.focus.path)
    expect(selection.anchor.offset).toBe(0)
    expect(selection.focus.offset).toBe(5)
    expect(roundTrip.startContainer).toBe(worldText)
    expect(roundTrip.startOffset).toBe(0)
    expect(roundTrip.endContainer).toBe(worldText)
    expect(roundTrip.endOffset).toBe(5)
  })

  it('round-trips a collapsed caret on an element container boundary', () => {
    const root = document.createElement('div')
    root.innerHTML = '<p>Hello <strong>world</strong></p>'
    const model = createDocumentModel(root)
    const paragraph = root.querySelector('p')

    if (!(paragraph instanceof HTMLElement)) {
      throw new Error('Expected paragraph element')
    }

    const range = document.createRange()
    range.setStart(paragraph, 1)
    range.collapse(true)

    const selection = fromDOMRange(model, range)
    const roundTrip = toDOMRange(model, selection)

    expect(selection.anchor).toEqual({
      path: model.blocks[0].path,
      offset: 1
    })
    expect(selection.focus).toEqual({
      path: model.blocks[0].path,
      offset: 1
    })
    expect(roundTrip.collapsed).toBe(true)
    expect(roundTrip.startContainer).toBe(paragraph)
    expect(roundTrip.startOffset).toBe(1)
  })

  it.each([
    ['empty paragraph', '<p></p>'],
    ['br-only block', '<p><br></p>']
  ])('round-trips a collapsed caret in an %s', (_, html) => {
    const root = document.createElement('div')
    root.innerHTML = html
    const model = createDocumentModel(root)
    const block = model.blocks[0]

    const range = document.createRange()
    range.setStart(block.element, 0)
    range.collapse(true)

    const selection = fromDOMRange(model, range)
    const roundTrip = toDOMRange(model, selection)

    expect(selection.anchor).toEqual({
      path: block.path,
      offset: 0
    })
    expect(selection.focus).toEqual({
      path: block.path,
      offset: 0
    })
    expect(roundTrip.collapsed).toBe(true)
    expect(roundTrip.startContainer).toBe(block.element)
    expect(roundTrip.startOffset).toBe(0)
  })
})
