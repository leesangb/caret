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

  it('preserves root-level stray text segments with distinct paths', () => {
    const root = document.createElement('div')
    root.innerHTML = 'lead<p>tail</p>mid'

    const model = createDocumentModel(root)

    expect(model.blocks).toHaveLength(3)
    expect(model.blocks[0].element).toBe(root)
    expect(model.blocks[0].text).toBe('lead')
    expect(model.blocks[0].runs.map((run) => run.text)).toEqual(['lead'])
    expect(model.blocks[1].text).toBe('tail')
    expect(model.blocks[2].text).toBe('mid')
    expect(model.blocks[0].path).not.toEqual(model.blocks[2].path)
  })

  it('creates placeholder runs for empty blocks', () => {
    const root = document.createElement('div')
    root.innerHTML = '<p></p>'

    const model = createDocumentModel(root)

    expect(model.blocks).toHaveLength(1)
    expect(model.blocks[0].text).toBe('')
    expect(model.blocks[0].runs).toHaveLength(1)
    expect(model.blocks[0].runs[0].placeholder).toBe(true)
    expect(model.blocks[0].runs[0].node).toBe(model.blocks[0].element)
    expect(model.blocks[0].runs[0].path).toEqual(model.blocks[0].path)
  })

  it('creates placeholder runs for br-only blocks', () => {
    const root = document.createElement('div')
    root.innerHTML = '<p><br></p>'

    const model = createDocumentModel(root)

    expect(model.blocks).toHaveLength(1)
    expect(model.blocks[0].text).toBe('')
    expect(model.blocks[0].runs).toHaveLength(1)
    expect(model.blocks[0].runs[0].placeholder).toBe(true)
    expect(model.blocks[0].runs[0].node).toBe(model.blocks[0].element)
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
