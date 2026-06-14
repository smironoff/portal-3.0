import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@sentry/react', () => ({
  init: vi.fn(),
  ErrorBoundary: vi.fn(),
  browserTracingIntegration: vi.fn(() => ({})),
}))

import * as Sentry from '@sentry/react'
import { initSentry } from './sentry'
import {
  scrubString,
  stripSensitiveParams,
  beforeBreadcrumb,
  beforeSend,
} from './sentry-filters'
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

  it('passes beforeSend and beforeBreadcrumb from sentry-filters', () => {
    initSentry({ ...baseConfig, SENTRY_DSN: 'https://key@sentry.io/123' }, '1.0.0')
    expect(Sentry.init).toHaveBeenCalledWith(
      expect.objectContaining({
        beforeSend: expect.any(Function),
        beforeBreadcrumb: expect.any(Function),
      })
    )
  })
})

// ---------------------------------------------------------------------------
// sentry-filters unit tests
// ---------------------------------------------------------------------------

describe('stripSensitiveParams', () => {
  it('removes token query param from a password-reset URL', () => {
    expect(stripSensitiveParams('https://app.test/account/reset/new?token=secret')).toBe(
      'https://app.test/account/reset/new'
    )
  })

  it('preserves other query params when removing token', () => {
    expect(stripSensitiveParams('https://app.test/x?token=secret&lang=en')).toBe(
      'https://app.test/x?lang=en'
    )
  })

  it('removes password param', () => {
    const result = stripSensitiveParams('https://app.test/login?password=hunter2&user=bob')
    expect(result).not.toContain('password=')
    expect(result).toContain('user=bob')
  })

  it('returns the original string for a non-parseable URL', () => {
    expect(stripSensitiveParams('not a url')).toBe('not a url')
  })

  it('returns unchanged URL when no sensitive params present', () => {
    const url = 'https://app.test/dashboard?tab=overview'
    expect(stripSensitiveParams(url)).toBe(url)
  })
})

describe('scrubString', () => {
  it('replaces email addresses', () => {
    expect(scrubString('Contact user@example.com for support')).toBe(
      'Contact [Filtered] for support'
    )
  })

  it('replaces 7+ digit account numbers', () => {
    expect(scrubString('Account 12345678 was flagged')).toBe('Account [Filtered] was flagged')
  })

  it('keeps short numbers (years, ports) intact', () => {
    const result = scrubString('Error in 2024 on port 8080')
    expect(result).toBe('Error in 2024 on port 8080')
  })
})

describe('beforeBreadcrumb', () => {
  it('drops console breadcrumbs', () => {
    expect(beforeBreadcrumb({ category: 'console', message: 'log output' })).toBeNull()
  })

  it('scrubs token from breadcrumb data.url', () => {
    const bc = beforeBreadcrumb({
      category: 'navigation',
      data: { url: 'https://app.test/account/reset/new?token=abc123' },
    })
    expect(bc).not.toBeNull()
    expect((bc!.data as Record<string, string>).url).not.toContain('token=')
  })

  it('scrubs token from breadcrumb data.to', () => {
    const bc = beforeBreadcrumb({
      category: 'navigation',
      data: { to: '/account/reset/new?token=abc123', from: '/account/login' },
    })
    expect(bc).not.toBeNull()
    expect((bc!.data as Record<string, string>).to).not.toContain('token=')
  })

  it('scrubs PII from breadcrumb message', () => {
    const bc = beforeBreadcrumb({ category: 'http', message: 'user@test.com failed login' })
    expect(bc).not.toBeNull()
    expect(bc!.message).not.toContain('@')
  })
})

describe('beforeSend', () => {
  it('strips token from request.url', () => {
    const event = {
      request: { url: 'https://app.test/account/reset/new?token=secret' },
    }
    const result = beforeSend(event as Parameters<typeof beforeSend>[0])
    expect(result).not.toBeNull()
    expect(result!.request!.url).not.toContain('token=')
  })

  it('drops NOISY events (ResizeObserver loop)', () => {
    const event = {
      message: 'ResizeObserver loop limit exceeded',
      exception: { values: [] },
    }
    expect(beforeSend(event as unknown as Parameters<typeof beforeSend>[0])).toBeNull()
  })

  it('passes through events with first-party frames', () => {
    const event = {
      exception: {
        values: [
          {
            type: 'Error',
            value: 'Something broke',
            stacktrace: {
              frames: [{ filename: 'https://app.test/static/js/main.abc123.js' }],
            },
          },
        ],
      },
    }
    const result = beforeSend(event as Parameters<typeof beforeSend>[0])
    expect(result).not.toBeNull()
  })

  it('scrubs account numbers from exception values', () => {
    const event = {
      exception: {
        values: [
          {
            type: 'Error',
            value: 'Failed for account 12345678',
            stacktrace: {
              frames: [{ filename: 'https://app.test/static/js/main.abc123.js' }],
            },
          },
        ],
      },
    }
    const result = beforeSend(event as Parameters<typeof beforeSend>[0])
    expect(result).not.toBeNull()
    const value = result?.exception?.values?.[0]?.value
    expect(value).not.toContain('12345678')
    expect(value).toContain('[Filtered]')
  })
})
