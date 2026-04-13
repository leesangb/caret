export type CaretAffinity = 'forward' | 'backward'

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
  node: Text
}

export interface NormalizedBlock {
  path: number[]
  text: string
  runs: NormalizedRun[]
  element: HTMLElement
}

export interface DocumentModel {
  root: HTMLElement
  blocks: NormalizedBlock[]
}
