import { CaretRoot } from '@caret/react'

export function App() {
  return (
    <main className="app-shell">
      <section className="editor-panel" aria-label="Caret playground">
        <div className="editor-panel__copy">
          <p className="eyebrow">Playground</p>
          <h1>Editable surface with Caret overlay</h1>
          <p>Click inside the editor to mount the selection overlay.</p>
        </div>

        <CaretRoot>
          <div
            className="editor-surface"
            contentEditable
            role="textbox"
            aria-label="Playground editor"
            spellCheck={false}
            suppressContentEditableWarning
          >
            <p>Try selecting this text.</p>
            <p>The overlay should appear on top of the content.</p>
          </div>
        </CaretRoot>
      </section>
    </main>
  )
}
