// Build-time environment validation. Run before `vite build --mode <mode>`.
// Fails the build (exit 1) if required vars are missing, or if a production
// build still points at non-production infrastructure. This is the build-time
// counterpart to the runtime guard in src/config/configStore.ts.
import { loadEnv } from 'vite'

const mode = process.argv[2] ?? 'production'
const env = loadEnv(mode, process.cwd(), '')

const required = ['VITE_API_URL', 'VITE_AUTH_URL', 'VITE_KEYCLOAK_URL', 'VITE_RATES_URL']
const missing = required.filter((k) => !env[k])
if (missing.length) {
  console.error(`[validate-env] mode "${mode}" is missing required vars: ${missing.join(', ')}`)
  process.exit(1)
}

if (mode === 'production') {
  const bad = required.map((k) => env[k]).filter((u) => /staging|uat|localhost/i.test(u))
  if (bad.length) {
    console.error(
      `[validate-env] production build blocked: config points at non-production infrastructure:\n  ${bad.join(
        '\n  '
      )}`
    )
    process.exit(1)
  }
}

console.log(`[validate-env] OK for mode "${mode}"`)
