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

function findBoundaryIndex(
  rects: SelectionGeometryRect[],
  boundary: SelectionGeometryRect,
) {
  return rects.findIndex((rect) => rect === boundary)
}

function findBoundaryAtOrBefore(
  rects: SelectionGeometryRect[],
  absoluteOffset: number,
): SelectionGeometryRect | null {
  let candidate: SelectionGeometryRect | null = null

  for (const rect of rects) {
    if (rect.caretOffset > absoluteOffset) {
      break
    }
    candidate = rect
  }

  return candidate
}

function findBoundaryAtOrAfter(
  rects: SelectionGeometryRect[],
  absoluteOffset: number,
): SelectionGeometryRect | null {
  for (const rect of rects) {
    if (rect.caretOffset >= absoluteOffset) {
      return rect
    }
  }

  return null
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

function normalizeResolvedOffset(
  geometry: SelectionGeometryBlock[],
  resolved: { blockIndex: number; offset: number },
  direction: 'backward' | 'forward',
) {
  const block = geometry.find((entry) => entry.blockIndex === resolved.blockIndex)
  if (block === undefined) {
    return resolved
  }

  const offsets = [...new Set(block.rects.map((rect) => rect.caretOffset))].sort((left, right) => left - right)
  if (offsets.includes(resolved.offset)) {
    return resolved
  }

  if (direction === 'backward') {
    let normalized = offsets[0] ?? resolved.offset
    for (const offset of offsets) {
      if (offset > resolved.offset) {
        break
      }
      normalized = offset
    }

    return {
      blockIndex: resolved.blockIndex,
      offset: normalized
    }
  }

  for (const offset of offsets) {
    if (offset >= resolved.offset) {
      return {
        blockIndex: resolved.blockIndex,
        offset
      }
    }
  }

  return {
    blockIndex: resolved.blockIndex,
    offset: offsets[offsets.length - 1] ?? resolved.offset
  }
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

  const normalizedStartOffset = normalizeResolvedOffset(geometry, startOffset, 'backward')
  const normalizedEndOffset = normalizeResolvedOffset(geometry, endOffset, 'forward')

  const selectionRects: OverlayRect[] = []
  const pushMergedSelectionRect = (nextRect: OverlayRect) => {
    const previous = selectionRects[selectionRects.length - 1]
    if (
      previous !== undefined &&
      previous.y === nextRect.y &&
      previous.height === nextRect.height &&
      Math.abs((previous.x + previous.width) - nextRect.x) < 0.001
    ) {
      previous.width += nextRect.width
      return
    }

    selectionRects.push(nextRect)
  }

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
      compareResolvedOffsets(normalizedStartOffset, lineEnd) >= 0 ||
      compareResolvedOffsets(normalizedEndOffset, lineStart) <= 0
    ) {
      continue
    }

    const startBoundary =
      compareResolvedOffsets(normalizedStartOffset, lineStart) <= 0
        ? first
        : normalizedStartOffset.blockIndex === line.blockIndex
          ? findBoundaryAtOrBefore(rects, normalizedStartOffset.offset)
          : null
    const endBoundary =
      compareResolvedOffsets(normalizedEndOffset, lineEnd) >= 0
        ? last
        : normalizedEndOffset.blockIndex === line.blockIndex
          ? findBoundaryAtOrAfter(rects, normalizedEndOffset.offset)
          : null

    if (startBoundary === null || endBoundary === null) {
      continue
    }
    const startIndex = findBoundaryIndex(rects, startBoundary)
    const endIndex = findBoundaryIndex(rects, endBoundary)

    if (startIndex < 0 || endIndex < 0 || startIndex >= endIndex) {
      continue
    }

    for (let index = startIndex; index < endIndex; index += 1) {
      const current = rects[index]
      const next = rects[index + 1]
      if (current === undefined || next === undefined) {
        continue
      }
      if (next.caretOffset === current.caretOffset) {
        continue
      }

      const width = next.caretX - current.caretX
      if (width <= 0) {
        continue
      }

      pushMergedSelectionRect({
        x: current.caretX,
        y: current.y,
        width,
        height: current.height
      })
    }
  }

  return {
    caret: null,
    selectionRects
  }
}
