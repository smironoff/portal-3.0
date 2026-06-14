/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs'
import path from 'node:path'

const DEV_HOST = 'portal-test.thinkmarkets.com'
const CERT_DIR = path.resolve(__dirname, '.certs')

// Read the local dev TLS cert/key if present. Returns undefined (plain HTTP)
// when the .certs folder is missing, so the config never throws for build/test.
function readDevHttps(): { key: Buffer; cert: Buffer } | undefined {
  const key = path.join(CERT_DIR, 'server.key')
  const cert = path.join(CERT_DIR, 'server.crt')
  if (!fs.existsSync(key) || !fs.existsSync(cert)) {
    console.warn(
      `[vite] ${CERT_DIR}/server.{key,crt} not found - dev server will fall back to HTTP`
    )
    return undefined
  }
  return { key: fs.readFileSync(key), cert: fs.readFileSync(cert) }
}

// Dev proxy ported from the legacy CRA src/setupProxy.js. The app talks to its
// own origin (https://portal-test.thinkmarkets.com) and these path prefixes are
// forwarded to the real upstreams, avoiding CORS in development.
// Flip `env` to point at a different backend tier.
const env: 'uat' | 'staging' | 'hk' | 'ld' = 'uat'
const upstreams = {
  uat: {
    api: 'https://portalappqa.thinkmarkets.com',
    auth: 'https://uat-auth-new.thinkmarkets.com',
    portal: 'https://portal-uat.thinkmarkets.com',
    exchangeRates: 'https://servicediscovery-staging.tfxcorp.com',
    fa2: 'https://servicediscovery-uat.tfxcorp.com',
    signals: 'https://servicediscovery-staging.tfxcorp.com/v1/acuity-trading',
  },
  staging: {
    api: 'https://portalappstaging.thinkmarkets.com',
    auth: 'https://uat-auth-new.thinkmarkets.com',
    portal: 'https://portal-staging.thinkmarkets.com',
    exchangeRates: 'https://servicediscovery-staging.tfxcorp.com',
    fa2: 'https://servicediscovery-staging.tfxcorp.com',
    signals: 'https://servicediscovery-staging.tfxcorp.com/v1/acuity-trading',
  },
  hk: {
    api: 'https://portalapp.thinkmarkets.com.cn',
    auth: 'https://auth-prod.thinkmarkets.com',
    portal: 'https://portal.thinkmarkets.com',
    exchangeRates: 'https://secure-service-discovery.thinkmarketscn.com',
    fa2: 'https://secure-service-discovery.thinkmarketscn.com',
    signals: 'https://servicediscovery-staging.tfxcorp.com/v1/acuity-trading',
  },
  ld: {
    api: 'https://portalapp.thinkmarkets.com',
    auth: 'https://auth-prod.thinkmarkets.com',
    portal: 'https://portal.thinkmarkets.com',
    exchangeRates: 'https://secure-service-discovery.thinkmarkets.com',
    fa2: 'https://secure-service-discovery.thinkmarkets.com',
    signals: 'https://servicediscovery-staging.tfxcorp.com/v1/acuity-trading',
  },
}

function devProxy() {
  const { api, auth, portal, exchangeRates, fa2, signals } = upstreams[env]
  const withOrigin = (target: string) => ({
    target,
    changeOrigin: true,
    secure: false,
    headers: { origin: portal },
  })
  return {
    '/cportal': withOrigin(api),
    '/auth': withOrigin(auth),
    '/user': withOrigin(auth),
    '/internal': withOrigin(auth),
    '/realms': { target: auth, changeOrigin: true, secure: false },
    '/authentication': { target: fa2, secure: false },
    '/address': { target: fa2, secure: false },
    '/exchange-rate': { target: exchangeRates, secure: false },
    '/signals': {
      target: signals,
      secure: false,
      rewrite: (p: string) => p.replace(/^\/signals/, ''),
    },
    '/venus': { target: 'https://thinkai.tfxcorp.com/uat', changeOrigin: true, secure: false },
  }
}

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
  server:
    command === 'serve'
      ? {
          host: DEV_HOST,
          port: 443,
          https: readDevHttps(),
          proxy: devProxy(),
        }
      : { port: 3000 },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['src/test/setup.ts'],
    exclude: ['e2e/**', 'node_modules/**'],
    server: {
      deps: {
        inline: ['@mui/material', '@mui/system', '@mui/utils', 'react-transition-group'],
      },
    },
  },
}))
