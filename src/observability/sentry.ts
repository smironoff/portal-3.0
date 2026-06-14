import * as Sentry from '@sentry/react'
import type { AppConfig } from '@/config/schema'

export const initSentry = (config: AppConfig, release: string) => {
  if (!config.SENTRY_DSN) return
  Sentry.init({
    dsn: config.SENTRY_DSN,
    environment: config.ENV,
    release,
    sendDefaultPii: false,
    maxBreadcrumbs: 30,
    integrations: [Sentry.browserTracingIntegration()],
    tracesSampleRate: config.ENV === 'uat' ? 0.1 : 0.01,
  })
}

export const SentryErrorBoundary = Sentry.ErrorBoundary
