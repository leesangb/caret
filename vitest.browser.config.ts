import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'
import { playwright } from '@vitest/browser-playwright'

export default defineConfig({
  resolve: {
    alias: {
      '@caret/core': resolve(import.meta.dirname, './packages/core/src/index.ts')
    }
  },
  test: {
    include: ['packages/*/tests/**/*.browser.test.ts'],
    browser: {
      enabled: true,
      headless: true,
      provider: playwright(),
      instances: [
        {
          browser: 'chromium'
        }
      ]
    }
  }
})
