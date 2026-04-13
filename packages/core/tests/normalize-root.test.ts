import { describe, expect, it } from 'vitest'
import { createDocumentModel } from '../src/model/normalize-root'

describe('createDocumentModel', () => {
  it('builds blocks and text nodes from nested inline content', () => {
    const root = document.createElement('div')
    root.innerHTML = `
      <p>Hello <strong>brave</strong> world</p>
      <p><em>second</em> line</p>
    `

    const model = createDocumentModel(root)

    expect(model.blocks).toHaveLength(2)
    expect(model.blocks[0].text).toBe('Hello brave world')
    expect(model.blocks[1].text).toBe('second line')
    expect(model.blocks[0].runs.map((run) => run.text)).toEqual(['Hello ', 'brave', ' world'])
  })
})
