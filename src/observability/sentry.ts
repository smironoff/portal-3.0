import * as Sentry from '@sentry/react'
import type { AppConfig } from '@/config/schema'
import { beforeBreadcrumb, beforeSend } from './sentry-filters'

export const initSentry = (config: AppConfig, release: string) => {
  if (!config.SENTRY_DSN) return
  Sentry.init({
    dsn: config.SENTRY_DSN,
    environment: config.ENV,
    release,
    sendDefaultPii: false,
    maxBreadcrumbs: 30,
    integrations: [Sentry.browserTracingIntegration()],
    tracePropagationTargets: [],
    tracesSampleRate: config.ENV === 'uat' ? 0.1 : 0.01,
    beforeBreadcrumb,
    beforeSend,
  })
}

export const SentryErrorBoundary = Sentry.ErrorBoundary
