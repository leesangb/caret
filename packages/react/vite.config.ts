import { resolve } from 'node:path'
import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    lib: {
      entry: resolve(import.meta.dirname, 'src/index.ts'),
      fileName: 'index',
      formats: ['es']
    },
    rollupOptions: {
      external: ['@caret/dom', 'react', 'react-dom']
    }
  },
  test: {
    environment: 'jsdom',
    resolve: {
      alias: {
        '@caret/core': resolve(import.meta.dirname, '../core/src/index.ts'),
        '@caret/dom': resolve(import.meta.dirname, '../dom/src/index.ts')
      }
    }
  }
})
