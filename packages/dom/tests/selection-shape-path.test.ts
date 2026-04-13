import { describe, expect, it } from 'vitest'
import { buildSelectionShapePath } from '../src'

describe('buildSelectionShapePath', () => {
  it('builds expanded pill paths and reports their bounds', () => {
    const shape = buildSelectionShapePath(
      [
        {
          x: 10,
          y: 20,
          width: 30,
          height: 12
        },
        {
          x: 8,
          y: 40,
          width: 50,
          height: 12
        }
      ],
      {
        kind: 'pill',
        paddingX: 4,
        paddingY: 2
      }
    )

    expect(shape.bounds).toEqual({
      x: 4,
      y: 18,
      width: 58,
      height: 36
    })
    expect(shape.path).toContain('M 14 18')
    expect(shape.path).toContain('M 12 38')
  })

  it('returns an empty shape for empty rect lists', () => {
    const shape = buildSelectionShapePath([], {
      kind: 'pill'
    })

    expect(shape.bounds).toBeNull()
    expect(shape.path).toBe('')
  })
})
