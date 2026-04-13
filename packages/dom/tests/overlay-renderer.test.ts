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
      caretWidth: 3
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
    expect((caret as HTMLElement).style.background).toContain('var(--caret-color')
    expect((caret as HTMLElement).style.borderRadius).toContain('var(--caret-radius')
    expect(selection).toBeInstanceOf(HTMLElement)
    expect((selection as HTMLElement).classList.contains('selection-part')).toBe(true)
    expect((selection as HTMLElement).style.background).toContain('var(--caret-selection-background')
    expect((selection as HTMLElement).style.outline).toContain('var(--caret-selection-outline')

    renderer.destroy()
    host.remove()
  })
})
