import { describe, expect, it, vi } from 'vitest'

vi.mock('@chenglou/pretext', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@chenglou/pretext')>()

  return {
    ...actual,
    prepare: vi.fn(actual.prepare)
  }
})

import * as pretext from '@chenglou/pretext'
import { createDocumentModel } from '../src/model/normalize-root'
import { createLayoutSession } from '../src/layout/create-layout-session'

describe('createLayoutSession', () => {
  it('reuses prepared text across width-only relayouts', () => {
    const root = document.createElement('div')
    root.innerHTML = '<p>Hello world from pretext</p>'
    const model = createDocumentModel(root)
    const prepareMock = vi.mocked(pretext.prepare)
    const context = {
      font: '',
      measureText: (text: string) => ({ width: text.length * 8 })
    } as CanvasRenderingContext2D

    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context)

    const session = createLayoutSession(model, { font: '16px sans-serif', lineHeight: 20 })

    const firstLayout = session.layout(200)
    const secondLayout = session.layout(120)

    expect(prepareMock).toHaveBeenCalledTimes(1)
    expect(firstLayout[0]?.lineCount).toBeGreaterThan(0)
    expect(secondLayout[0]?.lineCount).toBeGreaterThan(0)
  })
})
