export function toNodePath(node: Node, root: Node): number[] {
  const path: number[] = []
  let current: Node | null = node

  while (current && current !== root) {
    const parent: Node | null = current.parentNode
    if (!parent) {
      throw new Error('Node is outside root')
    }

    path.unshift(Array.prototype.indexOf.call(parent.childNodes, current))
    current = parent
  }

  if (current !== root) {
    throw new Error('Node is outside root')
  }

  return path
}
