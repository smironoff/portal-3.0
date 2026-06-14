import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { loadConfig } from './config/configStore'
import { initI18n } from './i18n/i18n'
import { initSentry } from './observability/sentry'

async function bootstrap() {
  const config = loadConfig() // synchronous: values come from build-time env
  initSentry(config, 'portal-3.0@dev')
  await initI18n(config.DEFAULT_LANGUAGE, 'dev')
  const rootEl = document.getElementById('root')
  if (!rootEl) throw new Error('Root element #root not found')
  createRoot(rootEl).render(
    <StrictMode>
      <App config={config} />
    </StrictMode>,
  )
}

bootstrap().catch((e) => {
  document.body.innerHTML = `<pre style="padding:24px">Failed to start: ${String(e)}</pre>`
})
