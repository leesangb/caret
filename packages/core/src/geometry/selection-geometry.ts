import type { CaretPosition, DocumentModel } from '../types'

export interface SelectionGeometryRect {
  x: number
  y: number
  width: number
  height: number
  position: CaretPosition
}

export interface SelectionGeometryBlock {
  blockIndex: number
  rects: SelectionGeometryRect[]
}

export interface GeometryOptions {
  blockWidth: number
  charWidth: number
  lineHeight: number
}

function getCharsPerLine(blockWidth: number, charWidth: number): number {
  if (charWidth <= 0) return 1
  return Math.max(1, Math.floor(blockWidth / charWidth))
}

export function createSelectionGeometry(
  model: DocumentModel,
  options: GeometryOptions
): SelectionGeometryBlock[] {
  const charsPerLine = getCharsPerLine(options.blockWidth, options.charWidth)
  const blocks: SelectionGeometryBlock[] = []
  let blockTop = 0

  for (let blockIndex = 0; blockIndex < model.blocks.length; blockIndex += 1) {
    const block = model.blocks[blockIndex]
    const rects: SelectionGeometryRect[] = []
    const lineCount = Math.max(1, Math.ceil(block.text.length / charsPerLine))

    for (const run of block.runs) {
      for (let charIndex = 0; charIndex < run.text.length; charIndex += 1) {
        const absoluteIndex = run.start + charIndex
        const lineIndex = Math.floor(absoluteIndex / charsPerLine)
        const columnIndex = absoluteIndex % charsPerLine

        rects.push({
          x: columnIndex * options.charWidth,
          y: blockTop + lineIndex * options.lineHeight,
          width: options.charWidth,
          height: options.lineHeight,
          position: {
            path: run.path,
            offset: charIndex
          }
        })
      }
    }

    blocks.push({
      blockIndex,
      rects
    })

    blockTop += lineCount * options.lineHeight
  }

  return blocks
}
