export type CaretAffinity = 'forward' | 'backward'

export type CaretSupportState =
  | {
      supported: true
    }
  | {
      supported: false
      reason: 'rtl-root'
    }

export interface CaretPosition {
  path: number[]
  offset: number
  affinity?: CaretAffinity
}

export interface CaretSelection {
  anchor: CaretPosition
  focus: CaretPosition
}

export interface NormalizedRun {
  path: number[]
  text: string
  start: number
  end: number
  node: Node
  font?: string
  lineHeight?: number
  letterSpacing?: number
  wordSpacing?: number
  placeholder?: true
}

export interface NormalizedBlock {
  path: number[]
  text: string
  runs: NormalizedRun[]
  element: HTMLElement
  font?: string
  lineHeight?: number
  letterSpacing?: number
  wordSpacing?: number
}

export interface DocumentModel {
  root: HTMLElement
  blocks: NormalizedBlock[]
}
