import { describe, expect, it } from 'vitest'
import { createOverlayRenderer } from '../src'

describe('createOverlayRenderer', () => {
  it('renders custom caret and selection parts with class names', () => {
    const host = document.createElement('div')
    document.body.appendChild(host)

    const renderer = createOverlayRenderer(host, {
      caret: {
        width: 3,
        color: '#111827',
        radius: 4
      },
      classNames: {
        root: 'overlay-root',
        caret: 'caret-part',
        selection: 'selection-part'
      },
      selection: {
        background: 'rgba(59, 130, 246, 0.22)',
        outline: '1px solid rgba(59, 130, 246, 0.35)',
        radius: 8
      }
    })

    renderer.render({
      visualState: {
        caret: {
          x: 12,
          y: 4,
          height: 20
        },
        selectionRects: [
          {
            x: 2,
            y: 4,
            width: 10,
            height: 20
          }
        ]
      }
    })

    const overlayRoot = host.querySelector('[data-caret-overlay="true"]')
    const caret = host.querySelector('[data-caret-overlay-part="caret"]')
    const selection = host.querySelector('[data-caret-overlay-part="selection"]')

    expect(overlayRoot).toBeInstanceOf(HTMLElement)
    expect((overlayRoot as HTMLElement).classList.contains('overlay-root')).toBe(true)
    expect(caret).toBeInstanceOf(HTMLElement)
    expect((caret as HTMLElement).classList.contains('caret-part')).toBe(true)
    expect((caret as HTMLElement).style.width).toBe('3px')
    expect((caret as HTMLElement).style.background).toBe('rgb(17, 24, 39)')
    expect((caret as HTMLElement).style.borderRadius).toBe('4px')
    expect(selection).toBeInstanceOf(HTMLElement)
    expect((selection as HTMLElement).classList.contains('selection-part')).toBe(true)
    expect((selection as HTMLElement).style.background).toBe('rgba(59, 130, 246, 0.22)')
    expect((selection as HTMLElement).style.outline).toBe('1px solid rgba(59, 130, 246, 0.35)')
    expect((selection as HTMLElement).style.borderRadius).toBe('8px')

    renderer.destroy()
    host.remove()
  })

  it('renders pill selections as a shared svg path', () => {
    const host = document.createElement('div')
    document.body.appendChild(host)

    const renderer = createOverlayRenderer(host, {
      selection: {
        background: 'rgba(16, 185, 129, 0.24)',
        outline: '1px solid rgba(15, 118, 110, 0.35)',
        shape: {
          kind: 'pill',
          paddingX: 4,
          paddingY: 2
        }
      }
    })

    renderer.render({
      visualState: {
        caret: null,
        selectionRects: [
          {
            x: 10,
            y: 20,
            width: 30,
            height: 12
          },
          {
            x: 8,
            y: 40,
            width: 50,
            height: 12
          }
        ]
      }
    })

    const shape = host.querySelector('[data-caret-overlay-shape="selection"]')
    const path = host.querySelector('[data-caret-overlay-shape-path="selection"]')

    expect(shape).toBeInstanceOf(SVGSVGElement)
    expect(path?.tagName.toLowerCase()).toBe('path')
    expect((shape as SVGSVGElement).style.overflow).toBe('visible')
    expect(path?.getAttribute('fill')).toBe('rgba(16, 185, 129, 0.24)')
    expect(path?.getAttribute('d')).toContain('M 14 18')

    renderer.destroy()
    host.remove()
  })

  it('applies configurable caret blink timing when requested', () => {
    const host = document.createElement('div')
    document.body.appendChild(host)

    const renderer = createOverlayRenderer(host, {
      caret: {
        blink: {
          onMs: 320,
          offMs: 180,
          delayMs: 90
        }
      }
    })

    renderer.render({
      visualState: {
        caret: {
          x: 12,
          y: 4,
          height: 20
        },
        selectionRects: []
      }
    })

    const caret = host.querySelector('[data-caret-overlay-part="caret"]')

    expect(caret).toBeInstanceOf(HTMLElement)
    expect((caret as HTMLElement).style.animationDuration).toBe('500ms')
    expect((caret as HTMLElement).style.animationDelay).toBe('90ms')
    expect((caret as HTMLElement).style.animationIterationCount).toBe('infinite')
    expect((caret as HTMLElement).style.animationTimingFunction).toBe('steps(1, end)')
    expect((caret as HTMLElement).style.animationName).toContain('caret-blink-')

    renderer.destroy()
    host.remove()
  })
})
