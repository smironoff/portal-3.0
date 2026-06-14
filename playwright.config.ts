import { defineConfig } from '@playwright/test'

// The dev server runs HTTPS on portal-test.thinkmarkets.com:443 (needs sudo).
// For e2e we override host/port via the Vite CLI to a non-privileged port and
// ignore the self-signed cert (it is issued for portal-test, not 127.0.0.1).
const E2E_ORIGIN = 'https://127.0.0.1:4173'

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
