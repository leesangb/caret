import type { CaretVisualState } from '@caret/core'

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
  classNames?: {
    root?: string
    caret?: string
    selection?: string
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
      marker.style.background = 'var(--caret-selection-background, rgba(30, 64, 175, 0.16))'
      marker.style.outline = 'var(--caret-selection-outline, 1px solid rgba(30, 64, 175, 0.18))'
      root.appendChild(marker)
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
      marker.style.background = 'var(--caret-color, rgba(15, 23, 42, 0.9))'
      marker.style.borderRadius = `var(--caret-radius, ${Math.min(caretWidth / 2, 2)}px)`
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
