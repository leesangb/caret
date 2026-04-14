import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '@caret/core': resolve(import.meta.dirname, './packages/core/src/index.ts'),
      '@caret/dom': resolve(import.meta.dirname, './packages/dom/src/index.ts'),
      '@caret/react': resolve(import.meta.dirname, './packages/react/src/index.ts')
    }
  },
  test: {
    environment: 'jsdom',
    include: ['packages/*/tests/**/*.test.ts', 'packages/*/tests/**/*.test.tsx'],
    exclude: ['packages/*/tests/**/*.browser.test.ts']
  }
})
