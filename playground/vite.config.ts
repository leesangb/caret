import { resolve } from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@caret/core': resolve(import.meta.dirname, '../packages/core/src/index.ts'),
      '@caret/dom': resolve(import.meta.dirname, '../packages/dom/src/index.ts'),
      '@caret/react': resolve(import.meta.dirname, '../packages/react/src/index.ts')
    }
  },
  build: {
    outDir: 'dist'
  }
})
