import { defineConfig } from '@playwright/test'

// The dev server falls back to HTTP when .certs/server.{key,crt} are absent.
// E2E tests use plain HTTP on a non-privileged port.
const E2E_ORIGIN = 'http://127.0.0.1:4173'

export default defineConfig({
  testDir: './e2e',
  webServer: {
    command: 'npm run dev -- --mode test --host 127.0.0.1 --port 4173',
    url: E2E_ORIGIN,
    reuseExistingServer: true,
    timeout: 120000,
    ignoreHTTPSErrors: true,
  },
  use: { baseURL: E2E_ORIGIN, ignoreHTTPSErrors: true },
})
