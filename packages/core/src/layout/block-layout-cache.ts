import { prepare, type PreparedText } from '@chenglou/pretext'

export class BlockLayoutCache {
  private preparedByKey = new Map<string, PreparedText>()

  get(text: string, font: string): PreparedText {
    const key = `${font}::${text}`
    const cached = this.preparedByKey.get(key)
    if (cached !== undefined) return cached

    const prepared = prepare(text, font)
    this.preparedByKey.set(key, prepared)
    return prepared
  }
}
