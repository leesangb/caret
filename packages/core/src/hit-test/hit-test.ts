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

  for (const block of boxes) {
    const lastCaretByLine = new Map<number, number>()

    for (const rect of block.rects) {
      const currentLastCaret = lastCaretByLine.get(rect.lineIndex)
      if (currentLastCaret === undefined || rect.caretOffset > currentLastCaret) {
        lastCaretByLine.set(rect.lineIndex, rect.caretOffset)
      }
    }

    for (const rect of block.rects) {
      const isLineTerminal = lastCaretByLine.get(rect.lineIndex) === rect.caretOffset
      const isSingleRectBlock = block.rects.length === 1
      const onRightEdge = point.x === rect.x + rect.width && point.y >= rect.y && point.y <= rect.y + rect.height
      const onEmptyBlockEdge =
        isSingleRectBlock &&
        point.x >= rect.x &&
        point.x <= rect.x + rect.width &&
        point.y === rect.y + rect.height

      if (isLineTerminal && (onRightEdge || onEmptyBlockEdge)) {
        return rect.position
      }
    }
  }

  return null
}
