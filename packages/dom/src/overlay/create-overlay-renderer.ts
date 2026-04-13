import type { SelectionGeometryBlock } from '@caret/core'

export interface OverlayRenderState {
  geometry: SelectionGeometryBlock[]
}

export interface OverlayRenderer {
  root: HTMLElement
  render(state: OverlayRenderState): void
  destroy(): void
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

export function createOverlayRenderer(host: HTMLElement): OverlayRenderer {
  const root = ensureOverlayRoot(host)
  let mounted = false

  const render = (state: OverlayRenderState) => {
    if (!mounted) {
      host.appendChild(root)
      mounted = true
    }

    root.replaceChildren()

    for (const block of state.geometry) {
      for (const rect of block.rects) {
        const marker = root.ownerDocument?.createElement('div') ?? document.createElement('div')
        marker.dataset.caretOverlayRect = 'true'
        marker.style.position = 'absolute'
        marker.style.left = `${rect.x}px`
        marker.style.top = `${rect.y}px`
        marker.style.width = `${Math.max(0, rect.width)}px`
        marker.style.height = `${Math.max(0, rect.height)}px`
        marker.style.background = 'rgba(30, 64, 175, 0.16)'
        marker.style.outline = '1px solid rgba(30, 64, 175, 0.18)'
        root.appendChild(marker)
      }
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
