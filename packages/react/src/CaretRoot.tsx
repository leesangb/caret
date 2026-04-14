import { attachCaret, type OverlayRenderer } from '@caret/dom'
import type { SelectionMergeStrategy } from '@caret/core'
import { cloneElement, useEffect, useState, type ReactElement, type Ref } from 'react'

export interface CaretRootProps {
  children: ReactElement
  createRenderer?: (host: HTMLElement) => OverlayRenderer
  selection?: {
    mergeStrategy?: SelectionMergeStrategy
  }
}

function assignRef<T>(ref: Ref<T> | undefined, value: T | null) {
  if (typeof ref === 'function') {
    ref(value)
    return
  }

  if (ref !== null && ref !== undefined) {
    ref.current = value
  }
}

export function CaretRoot({ children, createRenderer, selection }: CaretRootProps) {
  const [root, setRoot] = useState<HTMLElement | null>(null)
  const child = children as ReactElement<{ ref?: Ref<HTMLElement> }>
  const childRef = child.props.ref

  useEffect(() => {
    if (root === null) return

    const caret = attachCaret({ root, createRenderer, selection })
    caret.mount()

    return () => {
      caret.unmount()
    }
  }, [createRenderer, root, selection])

  return cloneElement(child, {
    ref: (node: HTMLElement | null) => {
      assignRef(childRef, node)
      setRoot((currentRoot) => (currentRoot === node ? currentRoot : node))
    }
  })
}
