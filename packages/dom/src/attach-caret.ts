import {
  createDocumentModel,
  createSelectionGeometry,
  fromDOMRange,
  hitTest as coreHitTest,
  toDOMRange,
  type CaretPosition,
  type CaretSelection,
  type CaretSupportState,
  type DocumentModel,
  type SelectionGeometryBlock
} from '@caret/core'
import { createInvalidator } from './observers/create-invalidator'
import { createOverlayRenderer } from './overlay/create-overlay-renderer'

type SelectionChangeListener = (selection: CaretSelection | null) => void

export interface AttachCaretOptions {
  root: HTMLElement
}

export interface AttachCaretController {
  readonly supportState: CaretSupportState
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

function comparePaths(left: number[], right: number[]): number {
  for (let index = 0; index < Math.min(left.length, right.length); index += 1) {
    if (left[index] !== right[index]) {
      return left[index] - right[index]
    }
  }

  return left.length - right.length
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

function comparePositionOrder(left: CaretPosition, right: CaretPosition): number {
  const pathComparison = comparePaths(left.path, right.path)
  if (pathComparison !== 0) return pathComparison

  return left.offset - right.offset
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

function toCaretPosition(model: DocumentModel, node: Node, offset: number): CaretPosition {
  const range = node.ownerDocument?.createRange() ?? document.createRange()
  range.setStart(node, offset)
  range.setEnd(node, offset)

  return fromDOMRange(model, range).anchor
}

function selectionFromDocument(root: HTMLElement, model = createDocumentModel(root)): CaretSelection | null {
  const selection = root.ownerDocument?.getSelection()
  if (selection === null || selection.anchorNode === null || selection.focusNode === null) {
    return null
  }

  if (!root.contains(selection.anchorNode) || !root.contains(selection.focusNode)) {
    return null
  }

  return {
    anchor: toCaretPosition(model, selection.anchorNode, selection.anchorOffset),
    focus: toCaretPosition(model, selection.focusNode, selection.focusOffset)
  }
}

function readModelWithoutOverlay(root: HTMLElement, overlayRoot: HTMLElement): DocumentModel {
  const parent = overlayRoot.parentNode
  const nextSibling = overlayRoot.nextSibling
  const wasAttachedToRoot = parent === root

  if (wasAttachedToRoot) {
    root.removeChild(overlayRoot)
  }

  try {
    return createDocumentModel(root)
  } finally {
    if (wasAttachedToRoot) {
      root.insertBefore(overlayRoot, nextSibling)
    }
  }
}

function getSupportState(root: HTMLElement): CaretSupportState {
  const view = root.ownerDocument?.defaultView ?? globalThis.window
  const computedDirection = view?.getComputedStyle(root).direction ?? root.dir

  if (
    computedDirection === 'rtl' ||
    root.dir === 'rtl' ||
    root.getAttribute('dir') === 'rtl'
  ) {
    return {
      supported: false,
      reason: 'rtl-root'
    }
  }

  return {
    supported: true
  }
}

export function attachCaret({ root }: AttachCaretOptions): AttachCaretController {
  const supportState = getSupportState(root)

  if (!supportState.supported) {
    return {
      supportState,
      mount() {},
      unmount() {},
      refresh() {},
      getSelection() {
        return null
      },
      setSelection(_selection: CaretSelection) {},
      setCollapsedPosition(_position: CaretPosition) {},
      setSelectionFromDOM() {
        return null
      },
      toDOMRange(selection: CaretSelection) {
        return toDOMRange(createDocumentModel(root), selection)
      },
      fromDOMRange(range: Range) {
        return fromDOMRange(createDocumentModel(root), range)
      },
      hitTest(_point: { x: number; y: number }) {
        return null
      },
      on(_event: 'selectionchange', _listener: SelectionChangeListener) {
        return () => undefined
      }
    }
  }

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
    const model = readModelWithoutOverlay(root, overlay.root)
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
    const model = snapshot?.model ?? createDocumentModel(root)
    const domSelection = root.ownerDocument?.getSelection()
    if (domSelection === null) return

    const anchorBoundary = toDOMRange(model, {
      anchor: selection.anchor,
      focus: selection.anchor
    })
    const focusBoundary = toDOMRange(model, {
      anchor: selection.focus,
      focus: selection.focus
    })

    const anchorNode = anchorBoundary.startContainer
    const anchorOffset = anchorBoundary.startOffset
    const focusNode = focusBoundary.startContainer
    const focusOffset = focusBoundary.startOffset
    const nativeSelection = domSelection as Selection & {
      setBaseAndExtent?: (
        anchorNode: Node,
        anchorOffset: number,
        focusNode: Node,
        focusOffset: number
      ) => void
    }

    if (typeof nativeSelection.setBaseAndExtent === 'function') {
      nativeSelection.setBaseAndExtent(anchorNode, anchorOffset, focusNode, focusOffset)
      return
    }

    domSelection.removeAllRanges()

    if (comparePositionOrder(selection.anchor, selection.focus) <= 0) {
      domSelection.addRange(toDOMRange(model, selection))
      return
    }

    if (typeof domSelection.collapse === 'function' && typeof domSelection.extend === 'function') {
      domSelection.collapse(anchorNode, anchorOffset)
      domSelection.extend(focusNode, focusOffset)
      return
    }

    domSelection.addRange(toDOMRange(model, selection))
  }

  function refresh() {
    const observer = mutationObserver

    observer?.disconnect()

    try {
      readSnapshot()
      if (snapshot !== null) {
        commitSelection(selectionFromDocument(root, snapshot.model), false)
      }
      render()
    } finally {
      if (mounted && mutationObserver === observer && observer !== null) {
        observer.observe(root, {
          subtree: true,
          childList: true,
          characterData: true
        })
      }
    }
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
    const nextSelection = selectionFromDocument(root, snapshot?.model ?? createDocumentModel(root))
    commitSelection(nextSelection, false)
    return nextSelection
  }

  function mount() {
    if (mounted) return

    mounted = true

    const computed = view?.getComputedStyle(root)
    if (computed?.position === 'static') {
      restorePositionStyle = root.style.position
      root.style.position = 'relative'
    }

    refresh()

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

    if (restorePositionStyle !== false) {
      root.style.position = restorePositionStyle
    }

    mounted = false
  }

  return {
    supportState,
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
