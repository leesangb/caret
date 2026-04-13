import type { DocumentModel, NormalizedBlock, NormalizedRun } from '../types'
import { toNodePath } from './path-map'

const BLOCK_TAGS = new Set(['p', 'div', 'li', 'blockquote', 'pre'])

function isBlockElement(node: Element): node is HTMLElement {
  return node instanceof HTMLElement && BLOCK_TAGS.has(node.tagName.toLowerCase())
}

function collectBlockElements(root: HTMLElement): HTMLElement[] {
  const blocks = Array.from(root.children).filter(isBlockElement)

  return blocks.length > 0 ? blocks : [root]
}

function collectRuns(block: HTMLElement, root: HTMLElement): NormalizedRun[] {
  const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT)
  const runs: NormalizedRun[] = []
  let start = 0

  for (let node = walker.nextNode() as Text | null; node; node = walker.nextNode() as Text | null) {
    if (!node.data) continue

    const text = node.data
    runs.push({
      path: toNodePath(node, root),
      text,
      start,
      end: start + text.length,
      node
    })
    start += text.length
  }

  return runs
}

export function createDocumentModel(root: HTMLElement): DocumentModel {
  const blocks: NormalizedBlock[] = collectBlockElements(root)
    .map((element) => {
      const runs = collectRuns(element, root)

      return {
        path: toNodePath(element, root),
        text: runs.map((run) => run.text).join(''),
        runs,
        element
      }
    })
    .filter((block) => block.text.length > 0)

  return { root, blocks }
}
