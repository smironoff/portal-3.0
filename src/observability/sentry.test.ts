import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@sentry/react', () => ({
  init: vi.fn(),
  ErrorBoundary: vi.fn(),
  browserTracingIntegration: vi.fn(() => ({})),
}))

import * as Sentry from '@sentry/react'
import { initSentry, stripParam } from './sentry'
import type { AppConfig } from '@/config/schema'

const baseConfig: AppConfig = {
  ENV: 'staging',
  API_URL: 'https://api.example.com',
  RATES_URL: 'https://rates.example.com',
  AUTH_URL: 'https://auth.example.com',
  KEYCLOAK_URL: 'https://kc.example.com',
  KEYCLOAK_REALM: 'portal',
  KEYCLOAK_CLIENT_ID: 'portal-web',
  DEFAULT_LANGUAGE: 'en',
  PULL_APP_STATUS_SEC: 30,
  PULL_NOTIFICATIONS_SEC: 300,
  LOGOUT_AFTER_MIN: 15,
  VERIFICATION_ATTEMPTS: 3,
  VERIFICATION_INTERVAL_SEC: 5,
  API_DATA_URL: 'https://api.example.com/nsdata',
  UPLOAD_URL: 'https://api.example.com/upload',
  PAYMENT_URL: 'https://api.example.com/payment',
  CAPTCHA_URL: 'https://api.example.com/captcha',
}

describe('initSentry', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('does not call Sentry.init when SENTRY_DSN is absent', () => {
    initSentry({ ...baseConfig, SENTRY_DSN: undefined }, '1.0.0')
    expect(Sentry.init).not.toHaveBeenCalled()
  })

  it('does not call Sentry.init when SENTRY_DSN is an empty string', () => {
    initSentry({ ...baseConfig, SENTRY_DSN: '' }, '1.0.0')
    expect(Sentry.init).not.toHaveBeenCalled()
  })

  it('calls Sentry.init with correct options when SENTRY_DSN is set', () => {
    initSentry({ ...baseConfig, SENTRY_DSN: 'https://key@sentry.io/123' }, '2.0.0')
    expect(Sentry.init).toHaveBeenCalledOnce()
    expect(Sentry.init).toHaveBeenCalledWith(
      expect.objectContaining({
        dsn: 'https://key@sentry.io/123',
        sendDefaultPii: false,
        environment: 'staging',
        release: '2.0.0',
      })
    )
  })

  it('applies a lower tracesSampleRate in uat environment', () => {
    initSentry({ ...baseConfig, ENV: 'uat', SENTRY_DSN: 'https://key@sentry.io/123' }, '1.0.0')
    expect(Sentry.init).toHaveBeenCalledWith(expect.objectContaining({ tracesSampleRate: 0.1 }))
  })

  it('applies the default tracesSampleRate in non-uat environments', () => {
    initSentry(
      { ...baseConfig, ENV: 'production', SENTRY_DSN: 'https://key@sentry.io/123' },
      '1.0.0'
    )
    expect(Sentry.init).toHaveBeenCalledWith(expect.objectContaining({ tracesSampleRate: 0.01 }))
  })
})

describe('stripParam', () => {
  it('removes the named query param from a URL', () => {
    expect(stripParam('https://app.test/account/reset/new?token=secret', 'token')).toBe(
      'https://app.test/account/reset/new'
    )
  })

  it('preserves other query params', () => {
    expect(stripParam('https://app.test/x?token=secret&lang=en', 'token')).toBe(
      'https://app.test/x?lang=en'
    )
  })

  it('returns the original string for a non-parseable URL', () => {
    expect(stripParam('not a url', 'token')).toBe('not a url')
  })
})
