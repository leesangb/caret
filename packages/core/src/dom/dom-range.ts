import type { CaretPosition, CaretSelection, DocumentModel } from '../types'
import { toNodePath } from '../model/path-map'

function comparePaths(left: number[], right: number[]): number {
  for (let i = 0; i < Math.min(left.length, right.length); i += 1) {
    if (left[i] !== right[i]) return left[i] - right[i]
  }

  return left.length - right.length
}

function comparePositions(left: CaretPosition, right: CaretPosition): number {
  const pathComparison = comparePaths(left.path, right.path)
  if (pathComparison !== 0) return pathComparison

  return left.offset - right.offset
}

function findRunByPath(model: DocumentModel, path: number[]) {
  for (const block of model.blocks) {
    for (const run of block.runs) {
      if (comparePaths(run.path, path) === 0) {
        return run
      }
    }
  }

  return null
}

function toCaretPosition(model: DocumentModel, node: Node, offset: number): CaretPosition {
  const path = toNodePath(node, model.root)
  const run = findRunByPath(model, path)

  if (run?.placeholder) {
    return { path, offset: 0 }
  }

  return { path, offset }
}

function resolvePosition(model: DocumentModel, position: CaretPosition): { node: Node; offset: number } {
  const run = findRunByPath(model, position.path)
  if (!run) {
    throw new Error('Unknown caret position')
  }

  return {
    node: run.node,
    offset: run.placeholder ? 0 : position.offset
  }
}

export function fromDOMRange(model: DocumentModel, range: Range): CaretSelection {
  return {
    anchor: toCaretPosition(model, range.startContainer, range.startOffset),
    focus: toCaretPosition(model, range.endContainer, range.endOffset)
  }
}

export function toDOMRange(model: DocumentModel, selection: CaretSelection): Range {
  const range = document.createRange()
  const [start, end] =
    comparePositions(selection.anchor, selection.focus) <= 0
      ? [selection.anchor, selection.focus]
      : [selection.focus, selection.anchor]

  const startBoundary = resolvePosition(model, start)
  const endBoundary = resolvePosition(model, end)

  range.setStart(startBoundary.node, startBoundary.offset)
  range.setEnd(endBoundary.node, endBoundary.offset)

  return range
}
