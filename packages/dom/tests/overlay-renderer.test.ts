import { describe, expect, it } from 'vitest'
import { createOverlayRenderer } from '../src'

describe('createOverlayRenderer', () => {
  it('renders custom caret and selection parts with class names', () => {
    const host = document.createElement('div')
    document.body.appendChild(host)

    const renderer = createOverlayRenderer(host, {
      classNames: {
        root: 'overlay-root',
        caret: 'caret-part',
        selection: 'selection-part'
      },
      caretWidth: 3,
      caretColor: '#111827',
      caretRadius: 4,
      selectionBackground: 'rgba(59, 130, 246, 0.22)',
      selectionOutline: '1px solid rgba(59, 130, 246, 0.35)',
      selectionRadius: 8
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
})
