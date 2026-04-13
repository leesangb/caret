import { layout } from '@chenglou/pretext'
import type { DocumentModel } from '../types'
import { BlockLayoutCache } from './block-layout-cache'

export interface LayoutSessionOptions {
  font: string
  lineHeight: number
}

export interface BlockLayoutResult {
  text: string
  lineCount: number
  height: number
  width: number
}

export function createLayoutSession(model: DocumentModel, options: LayoutSessionOptions) {
  const cache = new BlockLayoutCache()

  return {
    layout(width: number): BlockLayoutResult[] {
      return model.blocks.map((block) => {
        const prepared = cache.get(block.text, options.font)
        const result = layout(prepared, width, options.lineHeight)

        return {
          text: block.text,
          lineCount: result.lineCount,
          height: result.height,
          width
        }
      })
    }
  }
}
