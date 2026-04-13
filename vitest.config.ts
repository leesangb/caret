import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '@caret/core': resolve(import.meta.dirname, './packages/core/src/index.ts')
    }
  },
  test: {
    environment: 'jsdom',
    include: ['packages/*/tests/**/*.test.ts', 'packages/*/tests/**/*.test.tsx']
  }
})
