import * as Sentry from '@sentry/react'
import type { AppConfig } from '@/config/schema'

export const stripParam = (url: string, param: string): string => {
  try {
    const u = new URL(url)
    u.searchParams.delete(param)
    return u.toString()
  } catch {
    return url
  }
}

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
    beforeSend(event) {
      if (event.request?.url) event.request.url = stripParam(event.request.url, 'token')
      return event
    },
    beforeBreadcrumb(breadcrumb) {
      const d = breadcrumb.data as Record<string, unknown> | undefined
      if (d && typeof d.to === 'string') d.to = stripParam(d.to, 'token')
      if (d && typeof d.from === 'string') d.from = stripParam(d.from, 'token')
      return breadcrumb
    },
  })
}

export const SentryErrorBoundary = Sentry.ErrorBoundary
