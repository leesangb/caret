import {
  createDocumentModel,
  createSelectionGeometry,
  fromDOMRange,
  hitTest as coreHitTest,
  toDOMRange,
  type CaretPosition,
  type CaretSelection,
  type DocumentModel,
  type SelectionGeometryBlock
} from '../../core/src/index.ts'
import { createInvalidator } from './observers/create-invalidator'
import { createOverlayRenderer } from './overlay/create-overlay-renderer'

type SelectionChangeListener = (selection: CaretSelection | null) => void

export interface AttachCaretOptions {
  root: HTMLElement
}

export interface AttachCaretController {
  mount(): void
  unmount(): void
  refresh(): void
  getSelection(): CaretSelection | null
  setSelection(selection: CaretSelection): void
  setCollapsedPosition(position: CaretPosition): void
  setSelectionFromDOM(): CaretSelection | null
  toDOMRange(selection: CaretSelection): Range
  fromDOMRange(range: Range): CaretSelection
  hitTest(point: { x: number; y: number }): CaretPosition | null
  on(event: 'selectionchange', listener: SelectionChangeListener): () => void
}

interface Snapshot {
  model: DocumentModel
  geometry: SelectionGeometryBlock[]
}

function comparePositions(left: CaretPosition, right: CaretPosition) {
  if (left.path.length !== right.path.length) {
    return false
  }

  for (let index = 0; index < left.path.length; index += 1) {
    if (left.path[index] !== right.path[index]) {
      return false
    }
  }

  return left.offset === right.offset
}

function compareSelections(left: CaretSelection | null, right: CaretSelection | null) {
  if (left === right) return true
  if (left === null || right === null) return false

  return comparePositions(left.anchor, right.anchor) && comparePositions(left.focus, right.focus)
}

function getGeometryOptions(root: HTMLElement) {
  const view = root.ownerDocument?.defaultView ?? globalThis.window
  const computed = view ? view.getComputedStyle(root) : null
  const lineHeight = Number.parseFloat(computed?.lineHeight ?? '') || 20
  const font = computed?.font || '16px sans-serif'
  const blockWidth = Math.max(1, Math.round(root.getBoundingClientRect().width || root.clientWidth || 800))

  return {
    blockWidth,
    lineHeight,
    font
  }
}

function selectionFromDocument(root: HTMLElement): CaretSelection | null {
  const selection = root.ownerDocument?.getSelection()
  if (selection === null || selection.rangeCount === 0) {
    return null
  }

  const range = selection.getRangeAt(0)
  if (!root.contains(range.startContainer) || !root.contains(range.endContainer)) {
    return null
  }

  return fromDOMRange(createDocumentModel(root), range)
}

export function attachCaret({ root }: AttachCaretOptions): AttachCaretController {
  const overlay = createOverlayRenderer(root)
  const listeners = new Set<SelectionChangeListener>()
  let snapshot: Snapshot | null = null
  let mounted = false
  let currentSelection: CaretSelection | null = null
  let mutationObserver: MutationObserver | null = null
  let selectionListener: (() => void) | null = null
  let invalidator = createInvalidator(() => {
    refresh()
  })
  let restorePositionStyle = false
  const view = root.ownerDocument?.defaultView ?? globalThis.window

  const readSnapshot = () => {
    const model = createDocumentModel(root)
    snapshot = {
      model,
      geometry: createSelectionGeometry(model, getGeometryOptions(root))
    }
  }

  const emitSelection = () => {
    for (const listener of listeners) {
      listener(currentSelection)
    }
  }

  const render = () => {
    if (snapshot === null) {
      readSnapshot()
    }

    if (snapshot === null) return
    overlay.render({ geometry: snapshot.geometry })
  }

  function syncDomSelection(selection: CaretSelection) {
    const range = toDOMRange(snapshot?.model ?? createDocumentModel(root), selection)
    const domSelection = root.ownerDocument?.getSelection()
    if (domSelection === null) return

    domSelection.removeAllRanges()
    domSelection.addRange(range)
  }

  function refresh() {
    readSnapshot()
    render()
  }

  function commitSelection(nextSelection: CaretSelection | null, syncDom = true) {
    if (compareSelections(currentSelection, nextSelection)) {
      return
    }

    currentSelection = nextSelection

    if (syncDom && nextSelection !== null) {
      syncDomSelection(nextSelection)
    }

    emitSelection()
  }

  function scheduleRefresh() {
    invalidator.invalidate()
  }

  function setSelectionFromDOM() {
    const nextSelection = selectionFromDocument(root)
    commitSelection(nextSelection, false)
    return nextSelection
  }

  function mount() {
    if (mounted) return

    mounted = true

    const computed = view?.getComputedStyle(root)
    if (computed?.position === 'static' && root.style.position === '') {
      restorePositionStyle = true
      root.style.position = 'relative'
    }

    refresh()
    commitSelection(selectionFromDocument(root), false)

    const ownerDocument = root.ownerDocument
    if (ownerDocument !== null) {
      const onSelectionChange = () => {
        setSelectionFromDOM()
      }

      ownerDocument.addEventListener('selectionchange', onSelectionChange)
      selectionListener = () => {
        ownerDocument.removeEventListener('selectionchange', onSelectionChange)
      }
    }

    mutationObserver = new MutationObserver(() => {
      scheduleRefresh()
    })
    mutationObserver.observe(root, {
      subtree: true,
      childList: true,
      characterData: true
    })
  }

  function unmount() {
    if (!mounted) return

    invalidator.cancel()
    mutationObserver?.disconnect()
    mutationObserver = null
    selectionListener?.()
    selectionListener = null
    overlay.destroy()

    if (restorePositionStyle) {
      root.style.position = ''
    }

    mounted = false
  }

  return {
    mount,
    unmount,
    refresh,
    getSelection() {
      return currentSelection
    },
    setSelection(selection: CaretSelection) {
      commitSelection(selection, true)
    },
    setCollapsedPosition(position: CaretPosition) {
      commitSelection({
        anchor: position,
        focus: position
      }, true)
    },
    setSelectionFromDOM,
    toDOMRange(selection: CaretSelection) {
      return toDOMRange(snapshot?.model ?? createDocumentModel(root), selection)
    },
    fromDOMRange(range: Range) {
      return fromDOMRange(snapshot?.model ?? createDocumentModel(root), range)
    },
    hitTest(point: { x: number; y: number }) {
      if (snapshot === null) {
        readSnapshot()
      }

      if (snapshot === null) return null
      return coreHitTest(snapshot.model, snapshot.geometry, point)
    },
    on(event: 'selectionchange', listener: SelectionChangeListener) {
      if (event !== 'selectionchange') {
        return () => undefined
      }

      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    }
  }
}
