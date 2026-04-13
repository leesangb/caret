import type { OverlayRect } from '@caret/core'

export interface SelectionShapeOptions {
  kind?: 'rect' | 'pill'
  paddingX?: number
  paddingY?: number
  radius?: number
}

export interface SelectionShapePath {
  path: string
  bounds: OverlayRect | null
}

function formatNumber(value: number) {
  return `${Number(value.toFixed(2))}`
}

function roundedRectPath(x: number, y: number, width: number, height: number, radius: number) {
  const right = x + width
  const bottom = y + height
  const clampedRadius = Math.max(0, Math.min(radius, width / 2, height / 2))

  if (clampedRadius === 0) {
    return [
      `M ${formatNumber(x)} ${formatNumber(y)}`,
      `L ${formatNumber(right)} ${formatNumber(y)}`,
      `L ${formatNumber(right)} ${formatNumber(bottom)}`,
      `L ${formatNumber(x)} ${formatNumber(bottom)}`,
      'Z'
    ].join(' ')
  }

  return [
    `M ${formatNumber(x + clampedRadius)} ${formatNumber(y)}`,
    `L ${formatNumber(right - clampedRadius)} ${formatNumber(y)}`,
    `A ${formatNumber(clampedRadius)} ${formatNumber(clampedRadius)} 0 0 1 ${formatNumber(right)} ${formatNumber(y + clampedRadius)}`,
    `L ${formatNumber(right)} ${formatNumber(bottom - clampedRadius)}`,
    `A ${formatNumber(clampedRadius)} ${formatNumber(clampedRadius)} 0 0 1 ${formatNumber(right - clampedRadius)} ${formatNumber(bottom)}`,
    `L ${formatNumber(x + clampedRadius)} ${formatNumber(bottom)}`,
    `A ${formatNumber(clampedRadius)} ${formatNumber(clampedRadius)} 0 0 1 ${formatNumber(x)} ${formatNumber(bottom - clampedRadius)}`,
    `L ${formatNumber(x)} ${formatNumber(y + clampedRadius)}`,
    `A ${formatNumber(clampedRadius)} ${formatNumber(clampedRadius)} 0 0 1 ${formatNumber(x + clampedRadius)} ${formatNumber(y)}`,
    'Z'
  ].join(' ')
}

export function buildSelectionShapePath(
  rects: OverlayRect[],
  options: SelectionShapeOptions = {}
): SelectionShapePath {
  if (rects.length === 0) {
    return {
      path: '',
      bounds: null
    }
  }

  const paddingX = options.paddingX ?? 0
  const paddingY = options.paddingY ?? 0
  const expandedRects = rects.map((rect) => ({
    x: rect.x - paddingX,
    y: rect.y - paddingY,
    width: rect.width + paddingX * 2,
    height: rect.height + paddingY * 2
  }))

  const bounds = expandedRects.reduce<OverlayRect>(
    (current, rect) => {
      const left = Math.min(current.x, rect.x)
      const top = Math.min(current.y, rect.y)
      const right = Math.max(current.x + current.width, rect.x + rect.width)
      const bottom = Math.max(current.y + current.height, rect.y + rect.height)

      return {
        x: left,
        y: top,
        width: right - left,
        height: bottom - top
      }
    },
    {
      ...expandedRects[0]
    }
  )

  const path = expandedRects.map((rect) => {
    const radius = options.kind === 'pill'
      ? options.radius ?? rect.height / 2
      : options.radius ?? 0
    return roundedRectPath(rect.x, rect.y, rect.width, rect.height, radius)
  }).join(' ')

  return {
    path,
    bounds
  }
}
