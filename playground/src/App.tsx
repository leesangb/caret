import { buildSelectionShapePath, createOverlayRenderer, type OverlayRenderer } from '@caret/dom'
import { CaretRoot } from '@caret/react'
import type { ReactNode } from 'react'

interface ExampleCardProps {
  id: string
  title: string
  description: string
  createRenderer?: (host: HTMLElement) => OverlayRenderer
  editorClassName?: string
  children: ReactNode
}

function createStyledRenderer(host: HTMLElement) {
  return createOverlayRenderer(host, {
    caret: {
      width: 3,
      color: '#0f172a',
      radius: 3
    },
    selection: {
      background: 'rgba(37, 99, 235, 0.2)',
      outline: '1px solid rgba(37, 99, 235, 0.4)',
      radius: 8,
      shape: {
        kind: 'pill',
        paddingX: 4,
        paddingY: 2
      }
    },
    classNames: {
      root: 'styled-overlay',
      caret: 'styled-overlay__caret',
      selection: 'styled-overlay__selection'
    }
  })
}

function createCustomRenderer(host: HTMLElement): OverlayRenderer {
  const root = host.ownerDocument.createElement('div')
  root.dataset.caretCustom = 'true'
  root.setAttribute('aria-hidden', 'true')
  root.style.position = 'absolute'
  root.style.inset = '0'
  root.style.pointerEvents = 'none'
  root.style.overflow = 'hidden'
  root.style.zIndex = '9999'

  return {
    root,
    render({ visualState }) {
      if (!root.parentNode) {
        host.appendChild(root)
      }

      root.replaceChildren()

      for (const rect of visualState.selectionRects) {
        const selection = root.ownerDocument.createElement('div')
        selection.dataset.caretCustomPart = 'selection'
        selection.className = 'mint-overlay__selection'
        selection.style.position = 'absolute'
        selection.style.left = `${rect.x}px`
        selection.style.top = `${rect.y}px`
        selection.style.width = `${rect.width}px`
        selection.style.height = `${rect.height}px`
        root.appendChild(selection)
      }

      if (visualState.caret !== null) {
        const caret = root.ownerDocument.createElement('div')
        caret.dataset.caretCustomPart = 'caret'
        caret.className = 'mint-overlay__caret'
        caret.style.position = 'absolute'
        caret.style.left = `${visualState.caret.x}px`
        caret.style.top = `${visualState.caret.y}px`
        caret.style.width = '3px'
        caret.style.height = `${visualState.caret.height}px`
        root.appendChild(caret)
      }
    },
    destroy() {
      root.remove()
    }
  }
}

function createBubbleRenderer(host: HTMLElement): OverlayRenderer {
  const root = host.ownerDocument.createElementNS('http://www.w3.org/2000/svg', 'svg')
  root.dataset.caretCustom = 'bubble'
  root.setAttribute('aria-hidden', 'true')
  root.style.position = 'absolute'
  root.style.inset = '0'
  root.style.width = '100%'
  root.style.height = '100%'
  root.style.pointerEvents = 'none'
  root.style.overflow = 'visible'
  root.style.zIndex = '9999'

  return {
    root: root as unknown as HTMLElement,
    render({ visualState }) {
      if (!root.parentNode) {
        host.appendChild(root)
      }

      root.replaceChildren()
      root.setAttribute('viewBox', `0 0 ${Math.max(host.clientWidth, 1)} ${Math.max(host.clientHeight, 1)}`)

      if (visualState.selectionRects.length > 0) {
        const bubble = root.ownerDocument.createElementNS('http://www.w3.org/2000/svg', 'path')
        const shape = buildSelectionShapePath(visualState.selectionRects, {
          kind: 'pill',
          paddingX: 6,
          paddingY: 4
        })

        if (shape.bounds !== null) {
          const tailStartX = shape.bounds.x + Math.min(28, shape.bounds.width * 0.3)
          const tailBaseY = shape.bounds.y + shape.bounds.height
          const tail = [
            `M ${tailStartX} ${tailBaseY - 2}`,
            `L ${tailStartX + 12} ${tailBaseY + 2}`,
            `L ${tailStartX + 4} ${tailBaseY + 12}`,
            'Z'
          ].join(' ')

          bubble.dataset.caretCustomPart = 'selection-shape'
          bubble.setAttribute('d', `${shape.path} ${tail}`)
          bubble.setAttribute('fill', 'rgba(249, 115, 22, 0.18)')
          bubble.setAttribute('stroke', 'rgba(194, 65, 12, 0.45)')
          bubble.setAttribute('stroke-width', '1.5')
          bubble.setAttribute('filter', 'drop-shadow(0 6px 12px rgba(194, 65, 12, 0.12))')
          root.appendChild(bubble)
        }
      }

      if (visualState.caret !== null) {
        const caret = root.ownerDocument.createElementNS('http://www.w3.org/2000/svg', 'rect')
        caret.dataset.caretCustomPart = 'caret'
        caret.setAttribute('x', `${visualState.caret.x}`)
        caret.setAttribute('y', `${visualState.caret.y}`)
        caret.setAttribute('width', '3')
        caret.setAttribute('height', `${visualState.caret.height}`)
        caret.setAttribute('rx', '1.5')
        caret.setAttribute('fill', '#c2410c')
        root.appendChild(caret)
      }
    },
    destroy() {
      root.remove()
    }
  }
}

function ExampleCard({
  id,
  title,
  description,
  createRenderer,
  editorClassName,
  children
}: ExampleCardProps) {
  return (
    <section className="example-card" data-readme-example={id}>
      <div className="example-card__copy">
        <p className="eyebrow">{id}</p>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>

      <CaretRoot createRenderer={createRenderer}>
        <div
          className={['example-editor', editorClassName].filter(Boolean).join(' ')}
          contentEditable
          role="textbox"
          aria-label={`${title} editor`}
          spellCheck={false}
          suppressContentEditableWarning
          data-example-editor={id}
        >
          {children}
        </div>
      </CaretRoot>
    </section>
  )
}

export function App() {
  return (
    <main className="app-shell">
      <section className="editor-panel" aria-label="Caret playground">
        <div className="editor-panel__copy">
          <p className="eyebrow">Playground</p>
          <h1>Custom caret and selection examples</h1>
          <p>
            These examples are used both for manual testing and for README screenshots generated
            with Playwright.
          </p>
        </div>

        <div className="examples-grid">
          <ExampleCard
            id="basic"
            title="Basic Overlay"
            description="Default renderer with the built-in caret and selection look."
          >
            <p>Try selecting this text.</p>
            <p>The default overlay should appear on top of the content.</p>
          </ExampleCard>

          <ExampleCard
            id="multiline"
            title="Multiline Selection"
            description="Wrapped selections stay aligned line by line inside a narrow editor."
            editorClassName="example-editor--narrow"
          >
            <p>This example forces wrapping so you can verify multi-line selection painting.</p>
            <p>The selection overlay should break into separate rows and still align to text.</p>
          </ExampleCard>

          <ExampleCard
            id="mixed-typography"
            title="Mixed Typography"
            description="Validation case for mixed fonts, font sizes, inline emoji, and varied emphasis."
            editorClassName="example-editor--mixed"
          >
            <p>
              <span data-mixed-segment="intro">Studio </span>
              <span className="mixed-type mixed-type--serif" data-mixed-segment="serif">Serif</span>
              <span data-mixed-segment="middle"> meets </span>
              <span className="mixed-type mixed-type--mono" data-mixed-segment="mono">mono()</span>
              <span data-mixed-segment="emoji-start"> with ✨ </span>
              <span className="mixed-type mixed-type--display" data-mixed-segment="display">Loud</span>
              <span data-mixed-segment="emoji-end"> emoji 😄</span>
            </p>
            <p>
              <span className="mixed-type mixed-type--large" data-mixed-segment="large">Big beats</span>
              <span data-mixed-segment="tail"> small details and mixed baseline hops.</span>
            </p>
          </ExampleCard>

          <ExampleCard
            id="styled"
            title="CSS Styled Overlay"
            description="Same overlay renderer, but styled with appearance options and a pill selection shape."
            createRenderer={createStyledRenderer}
            editorClassName="example-editor--styled"
          >
            <p>A thinner caret can feel more editor-like.</p>
            <p>Use renderer options for pill shapes, radius, color, and outline without replacing the renderer.</p>
          </ExampleCard>

          <ExampleCard
            id="custom"
            title="Custom Renderer"
            description="A fully custom renderer with its own DOM structure."
            createRenderer={createCustomRenderer}
            editorClassName="example-editor--mint"
          >
            <p>This example draws its own mint selection blocks.</p>
            <p>Use this path when CSS alone is not enough.</p>
          </ExampleCard>

          <ExampleCard
            id="custom-shape"
            title="Custom Shape Helper"
            description="A custom bubble shape renderer built on top of the multiline shape helper."
            createRenderer={createBubbleRenderer}
            editorClassName="example-editor--bubble"
          >
            <p>This example turns selection rects into a speech-bubble style SVG path.</p>
            <p>The helper handles multiline geometry and the renderer adds its own tail and paint.</p>
          </ExampleCard>
        </div>
      </section>
    </main>
  )
}
