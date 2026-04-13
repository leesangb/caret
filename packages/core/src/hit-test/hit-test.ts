import type { CaretPosition, DocumentModel } from '../types'
import type { SelectionGeometryBlock } from '../geometry/selection-geometry'

export interface HitPoint {
  x: number
  y: number
}

export function hitTest(
  _model: DocumentModel,
  boxes: SelectionGeometryBlock[],
  point: HitPoint
): CaretPosition | null {
  for (const block of boxes) {
    for (const rect of block.rects) {
      if (
        point.x >= rect.x &&
        point.x < rect.x + rect.width &&
        point.y >= rect.y &&
        point.y < rect.y + rect.height
      ) {
        return rect.position
      }
    }
  }

  return null
}
