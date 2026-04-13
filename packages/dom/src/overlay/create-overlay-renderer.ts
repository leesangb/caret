import type { CaretVisualState } from '@caret/core'
import { buildSelectionShapePath, type SelectionShapeOptions } from './build-selection-shape-path'

export interface OverlayRenderState {
  visualState: CaretVisualState
}

export interface OverlayRenderer {
  root: HTMLElement
  render(state: OverlayRenderState): void
  destroy(): void
}

export interface OverlayRendererOptions {
  caretWidth?: number
  caretColor?: string
  caretRadius?: number | string
  selection?: {
    background?: string
    outline?: string
    radius?: number | string
    shape?: SelectionShapeOptions
  }
  classNames?: {
    root?: string
    caret?: string
    selection?: string
  }
}

function formatCssLength(value: number | string | undefined, fallback: string) {
  if (value === undefined) {
    return fallback
  }

  return typeof value === 'number' ? `${value}px` : value
}

function parseOutline(outline: string) {
  const match = outline.trim().match(/^([0-9.]+px)\s+\w+\s+(.+)$/)
  if (match === null) {
    return {
      strokeWidth: '1',
      stroke: outline
    }
  }

  return {
    strokeWidth: match[1].replace('px', ''),
    stroke: match[2]
  }
}

function ensureOverlayRoot(host: HTMLElement) {
  for (const child of Array.from(host.children)) {
    if (child instanceof HTMLElement && child.dataset.caretOverlay === 'true') {
      return child
    }
  }

  const overlay = host.ownerDocument?.createElement('div') ?? document.createElement('div')
  overlay.dataset.caretOverlay = 'true'
  overlay.setAttribute('aria-hidden', 'true')
  overlay.style.position = 'absolute'
  overlay.style.inset = '0'
  overlay.style.pointerEvents = 'none'
  overlay.style.overflow = 'hidden'
  overlay.style.zIndex = '9999'

  return overlay
}

export function createOverlayRenderer(
  host: HTMLElement,
  options: OverlayRendererOptions = {}
): OverlayRenderer {
  const root = ensureOverlayRoot(host)
  const caretWidth = options.caretWidth ?? 2
  const selectionOptions = options.selection ?? {}
  const caretBackground = options.caretColor ?? 'var(--caret-color, rgba(15, 23, 42, 0.9))'
  const caretRadius = formatCssLength(
    options.caretRadius,
    `var(--caret-radius, ${Math.min(caretWidth / 2, 2)}px)`
  )
  const selectionBackground =
    selectionOptions.background ?? 'var(--caret-selection-background, rgba(30, 64, 175, 0.16))'
  const selectionOutline =
    selectionOptions.outline ?? 'var(--caret-selection-outline, 1px solid rgba(30, 64, 175, 0.18))'
  const selectionRadius = formatCssLength(
    selectionOptions.radius,
    'var(--caret-selection-radius, 0px)'
  )
  const selectionShape = selectionOptions.shape
  let mounted = false

  if (options.classNames?.root !== undefined) {
    root.className = options.classNames.root
  }

  const render = (state: OverlayRenderState) => {
    if (!mounted) {
      host.appendChild(root)
      mounted = true
    }

    root.replaceChildren()

    const { caret, selectionRects } = state.visualState

    if (selectionShape?.kind === 'pill' && selectionRects.length > 0) {
      const shape = buildSelectionShapePath(selectionRects, selectionShape)
      if (shape.bounds !== null && shape.path.length > 0) {
        const svg = root.ownerDocument.createElementNS('http://www.w3.org/2000/svg', 'svg')
        const path = root.ownerDocument.createElementNS('http://www.w3.org/2000/svg', 'path')
        const outline = parseOutline(selectionOutline)
        const viewWidth = Math.max(host.clientWidth, shape.bounds.x + shape.bounds.width, 1)
        const viewHeight = Math.max(host.clientHeight, shape.bounds.y + shape.bounds.height, 1)

        svg.dataset.caretOverlayShape = 'selection'
        svg.setAttribute('aria-hidden', 'true')
        svg.setAttribute('viewBox', `0 0 ${viewWidth} ${viewHeight}`)
        svg.style.position = 'absolute'
        svg.style.inset = '0'
        svg.style.width = '100%'
        svg.style.height = '100%'
        svg.style.overflow = 'visible'

        path.dataset.caretOverlayShapePath = 'selection'
        if (options.classNames?.selection !== undefined) {
          path.setAttribute('class', options.classNames.selection)
        }
        path.setAttribute('d', shape.path)
        path.setAttribute('fill', selectionBackground)
        path.setAttribute('stroke', outline.stroke)
        path.setAttribute('stroke-width', outline.strokeWidth)

        svg.appendChild(path)
        root.appendChild(svg)
      }
    } else {
      for (const rect of selectionRects) {
        const marker = root.ownerDocument?.createElement('div') ?? document.createElement('div')
        marker.dataset.caretOverlayPart = 'selection'
        if (options.classNames?.selection !== undefined) {
          marker.className = options.classNames.selection
        }
        marker.style.position = 'absolute'
        marker.style.left = `${rect.x}px`
        marker.style.top = `${rect.y}px`
        marker.style.width = `${Math.max(0, rect.width)}px`
        marker.style.height = `${Math.max(0, rect.height)}px`
        marker.style.background = selectionBackground
        marker.style.outline = selectionOutline
        marker.style.borderRadius = selectionRadius
        root.appendChild(marker)
      }
    }

    if (caret !== null) {
      const marker = root.ownerDocument?.createElement('div') ?? document.createElement('div')
      marker.dataset.caretOverlayPart = 'caret'
      if (options.classNames?.caret !== undefined) {
        marker.className = options.classNames.caret
      }
      marker.style.position = 'absolute'
      marker.style.left = `${caret.x}px`
      marker.style.top = `${caret.y}px`
      marker.style.width = `${caretWidth}px`
      marker.style.height = `${Math.max(0, caret.height)}px`
      marker.style.background = caretBackground
      marker.style.borderRadius = caretRadius
      root.appendChild(marker)
    }
  }

  return {
    root,
    render,
    destroy() {
      root.remove()
      mounted = false
    }
  }
}
