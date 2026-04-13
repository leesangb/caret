import { attachCaret } from '@caret/dom'
import { cloneElement, useEffect, useRef, type ReactElement } from 'react'

export interface CaretRootProps {
  children: ReactElement
}

export function CaretRoot({ children }: CaretRootProps) {
  const rootRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    const root = rootRef.current
    if (root === null) return

    const caret = attachCaret({ root })
    caret.mount()

    return () => {
      caret.unmount()
    }
  }, [])

  return cloneElement(children, { ref: rootRef })
}
