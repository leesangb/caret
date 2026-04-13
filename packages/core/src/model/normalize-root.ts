import type { DocumentModel, NormalizedBlock, NormalizedRun } from '../types'
import { toNodePath } from './path-map'

const BLOCK_TAGS = new Set(['p', 'div', 'li', 'blockquote', 'pre'])

function isBlockElement(node: Element): node is HTMLElement {
  return node instanceof HTMLElement && BLOCK_TAGS.has(node.tagName.toLowerCase())
}

interface BlockSource {
  element: HTMLElement
  path: number[]
  nodes: Node[]
  placeholderNode: Node
}

function collectBlockSources(root: HTMLElement): BlockSource[] {
  const sources: BlockSource[] = []
  let syntheticNodes: Node[] = []

  const flushSynthetic = () => {
    if (syntheticNodes.length === 0) return
    const placeholderNode = syntheticNodes[0]
    sources.push({
      element: root,
      path: toNodePath(placeholderNode, root),
      nodes: syntheticNodes,
      placeholderNode
    })
    syntheticNodes = []
  }

  for (const node of Array.from(root.childNodes)) {
    if (node.nodeType === Node.ELEMENT_NODE && isBlockElement(node as Element)) {
      flushSynthetic()
      sources.push({
        element: node as HTMLElement,
        path: toNodePath(node, root),
        nodes: [node],
        placeholderNode: node
      })
      continue
    }

    syntheticNodes.push(node)
  }

  flushSynthetic()

  return sources.length > 0
    ? sources
    : [{ element: root, path: toNodePath(root, root), nodes: [root], placeholderNode: root }]
}

function collectTextNodes(node: Node): Text[] {
  if (node.nodeType === Node.TEXT_NODE) {
    return [node as Text]
  }

  const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT)
  const nodes: Text[] = []

  for (let current = walker.nextNode() as Text | null; current; current = walker.nextNode() as Text | null) {
    nodes.push(current)
  }

  return nodes
}

function collectRuns(source: BlockSource, root: HTMLElement): NormalizedRun[] {
  const runs: NormalizedRun[] = []
  let start = 0

  for (const node of source.nodes) {
    for (const textNode of collectTextNodes(node)) {
      if (!textNode.data) continue

      const text = textNode.data
      runs.push({
        path: toNodePath(textNode, root),
        text,
        start,
        end: start + text.length,
        node: textNode
      })
      start += text.length
    }
  }

  if (runs.length === 0) {
    runs.push({
      path: source.path,
      text: '',
      start: 0,
      end: 0,
      node: source.placeholderNode,
      placeholder: true
    })
  }

  return runs
}

export function createDocumentModel(root: HTMLElement): DocumentModel {
  const blocks: NormalizedBlock[] = collectBlockSources(root).map((source) => {
    const runs = collectRuns(source, root)

    return {
      path: source.path,
      text: runs.map((run) => run.text).join(''),
      runs,
      element: source.element
    }
  })

  return { root, blocks }
}
