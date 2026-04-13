import { createOverlayRenderer, type OverlayRenderer } from '@caret/dom'
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
    caretWidth: 3,
    caretColor: '#0f172a',
    caretRadius: 3,
    selectionBackground: 'rgba(37, 99, 235, 0.2)',
    selectionOutline: '1px solid rgba(37, 99, 235, 0.4)',
    selectionRadius: 8,
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
            id="styled"
            title="CSS Styled Overlay"
            description="Same overlay renderer, but styled with appearance options and optional classes."
            createRenderer={createStyledRenderer}
            editorClassName="example-editor--styled"
          >
            <p>A thinner caret can feel more editor-like.</p>
            <p>Use renderer options for radius, color, and outline without replacing the renderer.</p>
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
        </div>
      </section>
    </main>
  )
}
