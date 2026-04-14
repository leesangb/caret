import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './playground/tests',
  use: {
    baseURL: 'http://127.0.0.1:4173'
  },
  webServer: {
    command: 'pnpm --filter @caret/playground exec vite --host 127.0.0.1 --port 4173 --strictPort',
    port: 4173,
    reuseExistingServer: true
  }
})
