import { layoutWithLines, prepareWithSegments } from '@chenglou/pretext'
import type { CaretPosition, DocumentModel, NormalizedBlock } from '../types'

export interface SelectionGeometryRect {
  x: number
  y: number
  width: number
  height: number
  position: CaretPosition
  lineIndex: number
  caretOffset: number
}

export interface SelectionGeometryBlock {
  blockIndex: number
  rects: SelectionGeometryRect[]
}

export interface GeometryOptions {
  blockWidth: number
  lineHeight: number
  font: string
  charWidth?: number
}

function createMeasureContext(font: string): CanvasRenderingContext2D | null {
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')

  if (context === null) return null

  context.font = font
  return context
}

function measureUnitWidth(
  context: CanvasRenderingContext2D | null,
  unit: string,
  fallbackWidth: number,
): number {
  if (context !== null) {
    return context.measureText(unit).width
  }

  return fallbackWidth
}

function buildBoundaryWidths(
  context: CanvasRenderingContext2D | null,
  units: string[],
  fallbackWidth: number,
): number[] {
  const boundaries = [0]
  let total = 0

  for (const unit of units) {
    total += measureUnitWidth(context, unit, fallbackWidth)
    boundaries.push(total)
  }

  return boundaries
}

function resolveCaretPosition(block: NormalizedBlock, absoluteOffset: number): CaretPosition {
  if (block.runs.length === 0) {
    return { path: block.path, offset: 0 }
  }

  for (let runIndex = 0; runIndex < block.runs.length; runIndex += 1) {
    const run = block.runs[runIndex]!
    const runLength = run.text.length

    if (absoluteOffset < run.end) {
      return {
        path: run.path,
        offset: absoluteOffset - run.start
      }
    }

    if (absoluteOffset === run.end) {
      const nextRun = block.runs[runIndex + 1]
      if (nextRun !== undefined) {
        return {
          path: nextRun.path,
          offset: 0
        }
      }

      return {
        path: run.path,
        offset: runLength
      }
    }
  }

  const lastRun = block.runs[block.runs.length - 1]!
  return {
    path: lastRun.path,
    offset: lastRun.text.length
  }
}

function buildLineRects(
  block: NormalizedBlock,
  blockTop: number,
  layoutWidth: number,
  lineHeight: number,
  font: string,
  fallbackWidth: number,
  lineIndex: number,
  lineText: string,
  lineStartOffset: number,
): SelectionGeometryRect[] {
  const context = createMeasureContext(font)
  const lineUnits = Array.from(lineText)
  const boundaries = buildBoundaryWidths(context, lineUnits, fallbackWidth)
  const codeUnitBoundaries = [0]
  let codeUnitTotal = 0

  for (const unit of lineUnits) {
    codeUnitTotal += unit.length
    codeUnitBoundaries.push(codeUnitTotal)
  }

  const caretCount = Math.max(1, lineUnits.length + 1)
  const rects: SelectionGeometryRect[] = []

  for (let caretIndex = 0; caretIndex < caretCount; caretIndex += 1) {
    const left = caretIndex === 0 ? 0 : (boundaries[caretIndex - 1]! + boundaries[caretIndex]!) / 2
    const right =
      caretIndex === lineUnits.length
        ? layoutWidth
        : (boundaries[caretIndex]! + boundaries[caretIndex + 1]!) / 2

    rects.push({
      x: left,
      y: blockTop + lineIndex * lineHeight,
      width: Math.max(0, right - left),
      height: lineHeight,
      position: resolveCaretPosition(block, lineStartOffset + codeUnitBoundaries[caretIndex]!),
      lineIndex,
      caretOffset: lineStartOffset + codeUnitBoundaries[caretIndex]!
    })
  }

  if (rects.length === 0) {
    rects.push({
      x: 0,
      y: blockTop + lineIndex * lineHeight,
      width: layoutWidth,
      height: lineHeight,
      position: resolveCaretPosition(block, lineStartOffset),
      lineIndex,
      caretOffset: lineStartOffset
    })
  }

  return rects
}

export function createSelectionGeometry(model: DocumentModel, options: GeometryOptions): SelectionGeometryBlock[] {
  const blocks: SelectionGeometryBlock[] = []
  let blockTop = 0
  const fallbackWidth = options.charWidth ?? 0
  const preparedByText = new Map<string, ReturnType<typeof prepareWithSegments>>()

  for (let blockIndex = 0; blockIndex < model.blocks.length; blockIndex += 1) {
    const block = model.blocks[blockIndex]
    const prepared = preparedByText.get(block.text) ?? prepareWithSegments(block.text, options.font)
    preparedByText.set(block.text, prepared)
    const layout = layoutWithLines(prepared, options.blockWidth, options.lineHeight)

    if (layout.lineCount === 0) {
      blocks.push({
        blockIndex,
        rects: [
          {
            x: 0,
            y: blockTop,
            width: options.blockWidth,
            height: options.lineHeight,
            position: resolveCaretPosition(block, 0),
            lineIndex: 0,
            caretOffset: 0
          }
        ]
      })

      blockTop += options.lineHeight
      continue
    }

    const rects: SelectionGeometryRect[] = []
    let lineStartOffset = 0

    for (let lineIndex = 0; lineIndex < layout.lines.length; lineIndex += 1) {
      const line = layout.lines[lineIndex]!
      rects.push(
        ...buildLineRects(
          block,
          blockTop,
          options.blockWidth,
          options.lineHeight,
          options.font,
          fallbackWidth,
          lineIndex,
          line.text,
          lineStartOffset,
        )
      )
      lineStartOffset += line.text.length
    }

    blocks.push({
      blockIndex,
      rects
    })

    blockTop += layout.lineCount * options.lineHeight
  }

  return blocks
}
