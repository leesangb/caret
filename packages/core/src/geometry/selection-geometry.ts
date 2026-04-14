import {
  layoutWithLines,
  materializeLineRange,
  prepareWithSegments,
  type LayoutCursor,
  type PreparedTextWithSegments
} from '@chenglou/pretext'
import {
  layoutNextRichInlineLineRange,
  materializeRichInlineLineRange,
  prepareRichInline
} from '@chenglou/pretext/rich-inline'
import type { CaretPosition, DocumentModel, NormalizedBlock } from '../types'

export interface SelectionGeometryRect {
  x: number
  y: number
  width: number
  height: number
  caretX: number
  position: CaretPosition
  lineIndex: number
  caretOffset: number
}

export interface SelectionGeometryBlock {
  blockIndex: number
  originY: number
  rects: SelectionGeometryRect[]
}

export interface GeometryOptions {
  blockWidth: number
  lineHeight: number
  font: string
  charWidth?: number
}

interface InlineSpacing {
  letterSpacing?: number
  wordSpacing?: number
}

const EMPTY_CURSOR: LayoutCursor = {
  segmentIndex: 0,
  graphemeIndex: 0
}

function createMeasureContext(font: string): CanvasRenderingContext2D | null {
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')

  if (context === null) return null

  context.font = font
  return context
}

function getMeasureContext(
  cache: Map<string, CanvasRenderingContext2D | null>,
  font: string
) {
  const cached = cache.get(font)
  if (cached !== undefined) {
    return cached
  }

  const context = createMeasureContext(font)
  cache.set(font, context)
  return context
}

function measureFontBox(context: CanvasRenderingContext2D | null) {
  if (context === null) {
    return {
      ascent: 0,
      descent: 0
    }
  }

  const metrics = context.measureText('Mg')
  const ascent = Number.isFinite(metrics.fontBoundingBoxAscent)
    ? metrics.fontBoundingBoxAscent
    : metrics.actualBoundingBoxAscent
  const descent = Number.isFinite(metrics.fontBoundingBoxDescent)
    ? metrics.fontBoundingBoxDescent
    : metrics.actualBoundingBoxDescent

  return {
    ascent: ascent > 0 ? ascent : 0,
    descent: descent > 0 ? descent : 0
  }
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

function getInlineSpacingAdjustment(
  unit: string,
  index: number,
  totalUnits: number,
  spacing: InlineSpacing
) {
  let adjustment = 0

  if ((spacing.letterSpacing ?? 0) !== 0 && index < totalUnits - 1) {
    adjustment += spacing.letterSpacing ?? 0
  }

  if ((spacing.wordSpacing ?? 0) !== 0 && /\s/u.test(unit)) {
    adjustment += spacing.wordSpacing ?? 0
  }

  return adjustment
}

function buildBoundaryWidths(
  context: CanvasRenderingContext2D | null,
  units: string[],
  fallbackWidth: number,
  spacing: InlineSpacing = {},
): number[] {
  const boundaries = [0]
  let total = 0

  for (let index = 0; index < units.length; index += 1) {
    const unit = units[index]!
    total += measureUnitWidth(context, unit, fallbackWidth)
    total += getInlineSpacingAdjustment(unit, index, units.length, spacing)
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
  spacing: InlineSpacing,
  lineIndex: number,
  lineText: string,
  lineStartOffset: number,
): SelectionGeometryRect[] {
  const context = createMeasureContext(font)
  const lineUnits = Array.from(lineText)
  const boundaries = buildBoundaryWidths(context, lineUnits, fallbackWidth, spacing)
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
      caretX: boundaries[caretIndex]!,
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
      caretX: 0,
      position: resolveCaretPosition(block, lineStartOffset),
      lineIndex,
      caretOffset: lineStartOffset
    })
  }

  return rects
}

function trimBoundaryWhitespace(text: string) {
  const leadingMatch = text.match(/^[ \t\n\f\r]+/)
  const trailingMatch = text.match(/[ \t\n\f\r]+$/)

  return {
    leadingTrim: leadingMatch?.[0].length ?? 0,
    trailingTrim: trailingMatch?.[0].length ?? 0,
    trimmedText: text
      .replace(/^[ \t\n\f\r]+/, '')
      .replace(/[ \t\n\f\r]+$/, '')
  }
}

function getCursorCodeUnitOffset(prepared: PreparedTextWithSegments, end: LayoutCursor) {
  if (end.segmentIndex === 0 && end.graphemeIndex === 0) {
    return 0
  }

  return materializeLineRange(prepared, {
    start: EMPTY_CURSOR,
    end
  }).text.length
}

function buildLineRectsFromBoundaries(
  block: NormalizedBlock,
  lineIndex: number,
  lineWidth: number,
  boundaries: Array<{
    caretX: number
    caretOffset: number
    rectTop: number
    rectHeight: number
  }>
): SelectionGeometryRect[] {
  if (boundaries.length === 0) {
    return [
      {
        x: 0,
        y: 0,
        width: lineWidth,
        height: 0,
        caretX: 0,
        position: resolveCaretPosition(block, 0),
        lineIndex,
        caretOffset: 0
      }
    ]
  }

  return boundaries.map((boundary, index) => {
    const previous = boundaries[index - 1]
    const next = boundaries[index + 1]
    const left = previous === undefined ? 0 : (previous.caretX + boundary.caretX) / 2
    const right = next === undefined ? Math.max(lineWidth, boundary.caretX) : (boundary.caretX + next.caretX) / 2

    return {
      x: left,
      y: boundary.rectTop,
      width: Math.max(0, right - left),
      height: boundary.rectHeight,
      caretX: boundary.caretX,
      position: resolveCaretPosition(block, boundary.caretOffset),
      lineIndex,
      caretOffset: boundary.caretOffset
    }
  })
}

function shouldUseRichInline(block: NormalizedBlock, fallbackFont: string) {
  const runs = block.runs.filter((run) => !run.placeholder && run.text.length > 0)
  if (runs.length === 0) {
    return false
  }

  const blockFont = block.font ?? fallbackFont
  const blockLetterSpacing = block.letterSpacing ?? 0
  const blockWordSpacing = block.wordSpacing ?? 0

  return runs.some((run) => (
    (run.font ?? blockFont) !== blockFont ||
    (run.letterSpacing ?? blockLetterSpacing) !== blockLetterSpacing ||
    (run.wordSpacing ?? blockWordSpacing) !== blockWordSpacing ||
    (run.inlineStartInset ?? 0) !== 0 ||
    (run.inlineEndInset ?? 0) !== 0
  ))
}

function buildRichInlineRects(
  block: NormalizedBlock,
  blockTop: number,
  options: GeometryOptions,
  fallbackWidth: number,
  contextCache: Map<string, CanvasRenderingContext2D | null>
) {
  const richItems = block.runs
    .filter((run) => !run.placeholder)
    .map((run) => ({
      text: run.text,
      font: run.font ?? options.font,
      extraWidth: (run.inlineStartInset ?? 0) + (run.inlineEndInset ?? 0)
    }))

  const flow = prepareRichInline(richItems)
  const runPrepared = block.runs
    .filter((run) => !run.placeholder)
    .map((run) => {
      const font = run.font ?? options.font
      const trimmed = trimBoundaryWhitespace(run.text)

      return {
        run,
        font,
        leadingTrim: trimmed.leadingTrim,
        trailingTrim: trimmed.trailingTrim,
        letterSpacing: run.letterSpacing ?? block.letterSpacing,
        wordSpacing: run.wordSpacing ?? block.wordSpacing,
        inlineStartInset: run.inlineStartInset ?? 0,
        inlineEndInset: run.inlineEndInset ?? 0,
        prepared: prepareWithSegments(trimmed.trimmedText, font),
        metrics: measureFontBox(getMeasureContext(contextCache, font))
      }
    })

  const rects: SelectionGeometryRect[] = []
  let cursor: Parameters<typeof layoutNextRichInlineLineRange>[2] | undefined
  let lineIndex = 0
  let lineTop = blockTop

  while (true) {
    const range = layoutNextRichInlineLineRange(flow, options.blockWidth, cursor)
    if (range === null) {
      break
    }

    const line = materializeRichInlineLineRange(flow, range)
    const fragments: Array<{
      startX: number
      gapBefore: number
      boundariesInFragment: number[]
      codeUnitBoundaries: number[]
      absoluteStart: number
      leadingGapWidth: number
      leadingCaretOffset: number | null
      textStartInset: number
      textEndInset: number
      metrics: {
        ascent: number
        descent: number
      }
    }> = []
    const boundaries: Array<{
      caretX: number
      caretOffset: number
      rectTop: number
      rectHeight: number
    }> = []
    let x = 0
    let lineHeightForLine = block.lineHeight ?? options.lineHeight
    let lineAscent = 0
    let lineDescent = 0

    for (const fragment of line.fragments) {
      const preparedRun = runPrepared[fragment.itemIndex]
      if (preparedRun === undefined) {
        continue
      }

      lineHeightForLine = Math.max(
        lineHeightForLine,
        preparedRun.run.lineHeight ?? block.lineHeight ?? options.lineHeight
      )
      lineAscent = Math.max(lineAscent, preparedRun.metrics.ascent)
      lineDescent = Math.max(lineDescent, preparedRun.metrics.descent)

      const units = Array.from(fragment.text)
      const boundariesInFragment = buildBoundaryWidths(
        getMeasureContext(contextCache, preparedRun.font),
        units,
        fallbackWidth,
        {
          letterSpacing: preparedRun.letterSpacing,
          wordSpacing: preparedRun.wordSpacing
        }
      )
      const codeUnitBoundaries = [0]
      let codeUnitTotal = 0

      for (const unit of units) {
        codeUnitTotal += unit.length
        codeUnitBoundaries.push(codeUnitTotal)
      }

      const fragmentStart = getCursorCodeUnitOffset(preparedRun.prepared, fragment.start)
      const absoluteStart = preparedRun.run.start + preparedRun.leadingTrim + fragmentStart
      const hasLeadingCollapsedGap =
        fragmentStart === 0 &&
        preparedRun.leadingTrim > 0 &&
        fragment.gapBefore > 0
      const fragmentTextEnd = absoluteStart + codeUnitBoundaries[codeUnitBoundaries.length - 1]!
      const isFirstFragmentForRun = fragmentStart === 0
      const isLastFragmentForRun = fragmentTextEnd >= preparedRun.run.end - preparedRun.trailingTrim

      fragments.push({
        startX: x,
        gapBefore: fragment.gapBefore,
        boundariesInFragment,
        codeUnitBoundaries,
        absoluteStart,
        leadingGapWidth: hasLeadingCollapsedGap ? fragment.gapBefore : 0,
        leadingCaretOffset: hasLeadingCollapsedGap ? preparedRun.run.start : null,
        textStartInset: isFirstFragmentForRun ? preparedRun.inlineStartInset : 0,
        textEndInset: isLastFragmentForRun ? preparedRun.inlineEndInset : 0,
        metrics: preparedRun.metrics
      })

      x += fragment.gapBefore
      x += isFirstFragmentForRun ? preparedRun.inlineStartInset : 0
      x += boundariesInFragment[boundariesInFragment.length - 1] ?? 0
      x += isLastFragmentForRun ? preparedRun.inlineEndInset : 0
    }

    const lineMetricsHeight = lineAscent + lineDescent
    const halfLeading = lineMetricsHeight > 0
      ? Math.max(0, (lineHeightForLine - lineMetricsHeight) / 2)
      : 0
    const baselineY = lineTop + halfLeading + lineAscent

    for (const fragment of fragments) {
      const fragmentHeight = fragment.metrics.ascent + fragment.metrics.descent > 0
        ? Math.max(1, fragment.metrics.ascent + fragment.metrics.descent)
        : lineHeightForLine
      const fragmentTop = fragment.metrics.ascent + fragment.metrics.descent > 0
        ? baselineY - fragment.metrics.ascent
        : lineTop

      if (fragment.leadingGapWidth > 0 && fragment.leadingCaretOffset !== null) {
        boundaries.push({
          caretX: fragment.startX,
          caretOffset: fragment.leadingCaretOffset,
          rectTop: fragmentTop,
          rectHeight: fragmentHeight
        })
      }

      const fragmentOriginX = fragment.startX + fragment.gapBefore + fragment.textStartInset

      for (let caretIndex = 0; caretIndex < fragment.boundariesInFragment.length; caretIndex += 1) {
        boundaries.push({
          caretX: fragmentOriginX + fragment.boundariesInFragment[caretIndex]!,
          caretOffset: fragment.absoluteStart + fragment.codeUnitBoundaries[caretIndex]!,
          rectTop: fragmentTop,
          rectHeight: fragmentHeight
        })
      }
    }

    const actualLineWidth = boundaries[boundaries.length - 1]?.caretX ?? line.width

    rects.push(
      ...buildLineRectsFromBoundaries(
        block,
        lineIndex,
        actualLineWidth,
        boundaries
      )
    )

    cursor = line.end
    lineTop += lineHeightForLine
    lineIndex += 1
  }

  if (rects.length === 0) {
    rects.push({
      x: 0,
      y: lineTop,
      width: options.blockWidth,
      height: block.lineHeight ?? options.lineHeight,
      caretX: 0,
      position: resolveCaretPosition(block, 0),
      lineIndex: 0,
      caretOffset: 0
    })
  }

  return {
    rects,
    totalHeight: Math.max(block.lineHeight ?? options.lineHeight, lineTop - blockTop)
  }
}

export function createSelectionGeometry(model: DocumentModel, options: GeometryOptions): SelectionGeometryBlock[] {
  const blocks: SelectionGeometryBlock[] = []
  let blockTop = 0
  const fallbackWidth = options.charWidth ?? 0
  const preparedByText = new Map<string, ReturnType<typeof prepareWithSegments>>()
  const contextCache = new Map<string, CanvasRenderingContext2D | null>()

  for (let blockIndex = 0; blockIndex < model.blocks.length; blockIndex += 1) {
    const block = model.blocks[blockIndex]
    const blockLineHeight = block.lineHeight ?? options.lineHeight

    if (shouldUseRichInline(block, options.font)) {
      const rich = buildRichInlineRects(block, blockTop, options, fallbackWidth, contextCache)
      blocks.push({
        blockIndex,
        originY: blockTop,
        rects: rich.rects
      })
      blockTop += rich.totalHeight
      continue
    }

    const blockFont = block.font ?? options.font
    const prepareKey = `${blockFont}\u0000${block.text}`
    const prepared = preparedByText.get(prepareKey) ?? prepareWithSegments(block.text, blockFont)
    preparedByText.set(prepareKey, prepared)
    const layout = layoutWithLines(prepared, options.blockWidth, blockLineHeight)

    if (layout.lineCount === 0) {
      blocks.push({
        blockIndex,
        originY: blockTop,
        rects: [
          {
            x: 0,
            y: blockTop,
            width: options.blockWidth,
            height: blockLineHeight,
            caretX: 0,
            position: resolveCaretPosition(block, 0),
            lineIndex: 0,
            caretOffset: 0
          }
        ]
      })

      blockTop += blockLineHeight
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
          blockLineHeight,
          block.font ?? options.font,
          fallbackWidth,
          {
            letterSpacing: block.letterSpacing,
            wordSpacing: block.wordSpacing
          },
          lineIndex,
          line.text,
          lineStartOffset,
        )
      )
      lineStartOffset += line.text.length
    }

    blocks.push({
      blockIndex,
      originY: blockTop,
      rects
    })

    blockTop += layout.lineCount * blockLineHeight
  }

  return blocks
}
