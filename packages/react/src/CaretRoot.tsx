import { attachCaret } from '@caret/dom'
import { cloneElement, useEffect, useState, type ReactElement, type Ref } from 'react'

export interface CaretRootProps {
  children: ReactElement
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

export function CaretRoot({ children }: CaretRootProps) {
  const [root, setRoot] = useState<HTMLElement | null>(null)
  const childRef = (children.props as { ref?: Ref<HTMLElement> }).ref

  useEffect(() => {
    if (root === null) return

    const caret = attachCaret({ root })
    caret.mount()

    return () => {
      caret.unmount()
    }
  }, [root])

  return cloneElement(children, {
    ref: (node: HTMLElement | null) => {
      assignRef(childRef, node)
      setRoot((currentRoot) => (currentRoot === node ? currentRoot : node))
    }
  })
}
