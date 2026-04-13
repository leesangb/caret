import { describe, expect, it } from 'vitest'
import { createDocumentModel } from '../src/model/normalize-root'

describe('createDocumentModel', () => {
  it('builds blocks and text nodes from nested inline content', () => {
    const root = document.createElement('div')
    root.innerHTML = '<p>Hello <strong>brave</strong> world</p><p><em>second</em> line</p>'

    const model = createDocumentModel(root)

    expect(model.blocks).toHaveLength(2)
    expect(model.blocks[0].text).toBe('Hello brave world')
    expect(model.blocks[1].text).toBe('second line')
    expect(model.blocks[0].runs.map((run) => run.text)).toEqual(['Hello ', 'brave', ' world'])
  })

  it('preserves root-level stray text around a paragraph', () => {
    const root = document.createElement('div')
    root.innerHTML = 'lead<p>tail</p>'

    const model = createDocumentModel(root)

    expect(model.blocks).toHaveLength(2)
    expect(model.blocks[0].element).toBe(root)
    expect(model.blocks[0].text).toBe('lead')
    expect(model.blocks[0].runs.map((run) => run.text)).toEqual(['lead'])
    expect(model.blocks[1].text).toBe('tail')
  })

  it('preserves empty blocks as caret targets', () => {
    const root = document.createElement('div')
    root.innerHTML = '<p></p>'

    const model = createDocumentModel(root)

    expect(model.blocks).toHaveLength(1)
    expect(model.blocks[0].text).toBe('')
    expect(model.blocks[0].runs).toEqual([])
  })

  it('does not duplicate descendant text across nested blocks', () => {
    const root = document.createElement('div')
    root.innerHTML = '<div><p>x</p></div>'

    const model = createDocumentModel(root)

    expect(model.blocks).toHaveLength(1)
    expect(model.blocks[0].text).toBe('x')
    expect(model.blocks[0].runs.map((run) => run.text)).toEqual(['x'])
  })
})
