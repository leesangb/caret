import { resolve } from 'node:path'
import { defineConfig } from 'vite'

export default defineConfig({
  resolve: {
    alias: {
      '@caret/core': resolve(import.meta.dirname, '../core/src/index.ts')
    }
  },
  build: {
    lib: {
      entry: resolve(import.meta.dirname, 'src/index.ts'),
      fileName: 'index',
      formats: ['es']
    }
  },
  test: {
    environment: 'jsdom'
  }
})
