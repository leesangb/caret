import type { CaretPosition, CaretSelection, DocumentModel } from '../types'
import type { SelectionGeometryBlock, SelectionGeometryRect } from '../geometry/selection-geometry'

export interface OverlayRect {
  x: number
  y: number
  width: number
  height: number
}

export interface CaretVisual {
  x: number
  y: number
  height: number
}

export interface CaretVisualState {
  caret: CaretVisual | null
  selectionRects: OverlayRect[]
}

function comparePaths(left: number[], right: number[]): number {
  for (let index = 0; index < Math.min(left.length, right.length); index += 1) {
    if (left[index] !== right[index]) {
      return left[index] - right[index]
    }
  }

  return left.length - right.length
}

function comparePositions(left: CaretPosition, right: CaretPosition) {
  if (left.path.length !== right.path.length) {
    return false
  }

  for (let index = 0; index < left.path.length; index += 1) {
    if (left.path[index] !== right.path[index]) {
      return false
    }
  }

  return left.offset === right.offset
}

function comparePositionOrder(left: CaretPosition, right: CaretPosition): number {
  const pathComparison = comparePaths(left.path, right.path)
  if (pathComparison !== 0) return pathComparison

  return left.offset - right.offset
}

function resolveNodeFromPath(root: Node, path: number[]): Node | null {
  let current: Node = root

  for (const index of path) {
    const next = current.childNodes[index]
    if (next === undefined) {
      return null
    }

    current = next
  }

  return current
}

function resolveAbsoluteOffset(
  model: DocumentModel,
  position: CaretPosition,
): { blockIndex: number; offset: number } | null {
  const node = resolveNodeFromPath(model.root, position.path)

  for (let blockIndex = 0; blockIndex < model.blocks.length; blockIndex += 1) {
    const block = model.blocks[blockIndex]

    for (const run of block.runs) {
      if (run.path.length !== position.path.length) {
        continue
      }

      let samePath = true
      for (let index = 0; index < run.path.length; index += 1) {
        if (run.path[index] !== position.path[index]) {
          samePath = false
          break
        }
      }

      if (!samePath) {
        continue
      }

      return {
        blockIndex,
        offset: run.start + position.offset
      }
    }

    if (
      node !== null &&
      (block.element === node || block.element.contains(node))
    ) {
      const range = model.root.ownerDocument?.createRange() ?? document.createRange()
      range.setStart(block.element, 0)
      range.setEnd(node, position.offset)

      return {
        blockIndex,
        offset: range.toString().length
      }
    }
  }

  return null
}

function findBoundary(
  rects: SelectionGeometryRect[],
  absoluteOffset: number,
): SelectionGeometryRect | null {
  return rects.find((rect) => rect.caretOffset === absoluteOffset) ?? null
}

function compareResolvedOffsets(
  left: { blockIndex: number; offset: number },
  right: { blockIndex: number; offset: number },
) {
  if (left.blockIndex !== right.blockIndex) {
    return left.blockIndex - right.blockIndex
  }

  return left.offset - right.offset
}

function getLineRects(geometry: SelectionGeometryBlock[]) {
  const lineRects: Array<{
    blockIndex: number
    rects: SelectionGeometryRect[]
  }> = []

  for (const block of geometry) {
    let currentLineIndex: number | null = null
    let currentLine: SelectionGeometryRect[] = []

    for (const rect of block.rects) {
      if (currentLineIndex === null || rect.lineIndex !== currentLineIndex) {
        if (currentLine.length > 0) {
          lineRects.push({
            blockIndex: block.blockIndex,
            rects: currentLine
          })
        }

        currentLineIndex = rect.lineIndex
        currentLine = [rect]
        continue
      }

      currentLine.push(rect)
    }

    if (currentLine.length > 0) {
      lineRects.push({
        blockIndex: block.blockIndex,
        rects: currentLine
      })
    }
  }

  return lineRects
}

export function deriveVisualState(
  model: DocumentModel,
  selection: CaretSelection | null,
  geometry: SelectionGeometryBlock[],
): CaretVisualState {
  if (selection === null) {
    return {
      caret: null,
      selectionRects: []
    }
  }

  const collapsed = comparePositions(selection.anchor, selection.focus)
  const lineRects = getLineRects(geometry)

  if (collapsed) {
    const boundaryOffset = resolveAbsoluteOffset(model, selection.anchor)
    if (boundaryOffset === null) {
      return {
        caret: null,
        selectionRects: []
      }
    }

    for (const line of lineRects) {
      const rects = line.rects
      const boundary = findBoundary(rects, boundaryOffset.offset)
      if (boundary !== null) {
        return {
          caret: {
            x: boundary.caretX,
            y: boundary.y,
            height: boundary.height
          },
          selectionRects: []
        }
      }
    }

    return {
      caret: null,
      selectionRects: []
    }
  }

  const [start, end] =
    comparePositionOrder(selection.anchor, selection.focus) <= 0
      ? [selection.anchor, selection.focus]
      : [selection.focus, selection.anchor]
  const startOffset = resolveAbsoluteOffset(model, start)
  const endOffset = resolveAbsoluteOffset(model, end)

  if (startOffset === null || endOffset === null) {
    return {
      caret: null,
      selectionRects: []
    }
  }

  const selectionRects: OverlayRect[] = []

  for (const line of lineRects) {
    const rects = line.rects
    const first = rects[0]
    const last = rects[rects.length - 1]
    if (first === undefined || last === undefined) {
      continue
    }

    const lineStart = {
      blockIndex: line.blockIndex,
      offset: first.caretOffset
    }
    const lineEnd = {
      blockIndex: line.blockIndex,
      offset: last.caretOffset
    }

    if (
      compareResolvedOffsets(startOffset, lineEnd) >= 0 ||
      compareResolvedOffsets(endOffset, lineStart) <= 0
    ) {
      continue
    }

    const startBoundary =
      compareResolvedOffsets(startOffset, lineStart) <= 0
        ? first
        : startOffset.blockIndex === line.blockIndex
          ? findBoundary(rects, startOffset.offset)
          : null
    const endBoundary =
      compareResolvedOffsets(endOffset, lineEnd) >= 0
        ? last
        : endOffset.blockIndex === line.blockIndex
          ? findBoundary(rects, endOffset.offset)
          : null

    if (startBoundary === null || endBoundary === null) {
      continue
    }

    const width = endBoundary.caretX - startBoundary.caretX
    if (width <= 0) {
      continue
    }

    selectionRects.push({
      x: startBoundary.caretX,
      y: first.y,
      width,
      height: first.height
    })
  }

  return {
    caret: null,
    selectionRects
  }
}
