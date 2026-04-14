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

function getTextHost(root: HTMLElement, node: Node): HTMLElement {
  if (node instanceof HTMLElement) {
    return node
  }

  return node.parentElement ?? root
}

function getCanvasFont(element: HTMLElement) {
  const view = element.ownerDocument?.defaultView ?? globalThis.window
  const computed = view?.getComputedStyle(element)
  if (computed === null || computed === undefined) {
    return undefined
  }

  if (computed.font.length > 0) {
    return computed.font
  }

  const size = computed.fontSize || '16px'
  const family = computed.fontFamily || 'sans-serif'
  const style = computed.fontStyle && computed.fontStyle !== 'normal' ? `${computed.fontStyle} ` : ''
  const variant = computed.fontVariant && computed.fontVariant !== 'normal' ? `${computed.fontVariant} ` : ''
  const weight = computed.fontWeight && computed.fontWeight !== 'normal' ? `${computed.fontWeight} ` : ''

  return `${style}${variant}${weight}${size} ${family}`.trim()
}

function getLineHeight(element: HTMLElement) {
  const view = element.ownerDocument?.defaultView ?? globalThis.window
  const computed = view?.getComputedStyle(element)
  const parsed = Number.parseFloat(computed?.lineHeight ?? '')

  return Number.isFinite(parsed) ? parsed : undefined
}

function getSpacingValue(
  element: HTMLElement,
  property: 'letterSpacing' | 'wordSpacing'
) {
  const view = element.ownerDocument?.defaultView ?? globalThis.window
  const computed = view?.getComputedStyle(element)
  const raw = computed?.[property]
  if (raw === undefined || raw === null || raw === '' || raw === 'normal') {
    return undefined
  }

  const parsed = Number.parseFloat(raw)
  return Number.isFinite(parsed) && parsed !== 0 ? parsed : undefined
}

function getInlineInset(
  element: HTMLElement,
  side: 'Left' | 'Right'
) {
  const view = element.ownerDocument?.defaultView ?? globalThis.window
  const computed = view?.getComputedStyle(element)
  const padding = Number.parseFloat(computed?.[`padding${side}` as 'paddingLeft'] ?? '')
  const border = Number.parseFloat(computed?.[`border${side}Width` as 'borderLeftWidth'] ?? '')
  const total = (Number.isFinite(padding) ? padding : 0) + (Number.isFinite(border) ? border : 0)

  return total > 0 ? total : undefined
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
        node: textNode,
        font: getCanvasFont(getTextHost(root, textNode)),
        lineHeight: getLineHeight(getTextHost(root, textNode)),
        letterSpacing: getSpacingValue(getTextHost(root, textNode), 'letterSpacing'),
        wordSpacing: getSpacingValue(getTextHost(root, textNode), 'wordSpacing'),
        inlineStartInset: getInlineInset(getTextHost(root, textNode), 'Left'),
        inlineEndInset: getInlineInset(getTextHost(root, textNode), 'Right')
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
      element: source.element,
      font: getCanvasFont(source.element),
      lineHeight: getLineHeight(source.element),
      letterSpacing: getSpacingValue(source.element, 'letterSpacing'),
      wordSpacing: getSpacingValue(source.element, 'wordSpacing')
    }
  })

  return { root, blocks }
}
