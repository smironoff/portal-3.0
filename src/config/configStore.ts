import { rawConfigSchema } from './schema'
import type { AppConfig } from './schema'

let cached: AppConfig | undefined

const readEnv = (): Record<string, string | undefined> => {
  const e = import.meta.env
  return {
    ENV: e.VITE_ENV ?? e.MODE,
    API_URL: e.VITE_API_URL,
    RATES_URL: e.VITE_RATES_URL,
    AUTH_URL: e.VITE_AUTH_URL,
    KEYCLOAK_URL: e.VITE_KEYCLOAK_URL,
    KEYCLOAK_REALM: e.VITE_KEYCLOAK_REALM,
    KEYCLOAK_CLIENT_ID: e.VITE_KEYCLOAK_CLIENT_ID,
    DEFAULT_LANGUAGE: e.VITE_DEFAULT_LANGUAGE,
    PULL_APP_STATUS_SEC: e.VITE_PULL_APP_STATUS_SEC,
    PULL_NOTIFICATIONS_SEC: e.VITE_PULL_NOTIFICATIONS_SEC,
    LOGOUT_AFTER_MIN: e.VITE_LOGOUT_AFTER_MIN,
    VERIFICATION_ATTEMPTS: e.VITE_VERIFICATION_ATTEMPTS,
    VERIFICATION_INTERVAL_SEC: e.VITE_VERIFICATION_INTERVAL_SEC,
    WTR_URL: e.VITE_WTR_URL,
    PAMM_PORTAL: e.VITE_PAMM_PORTAL,
    VENUS_API_URL: e.VITE_VENUS_API_URL,
    BROKEREE_URL: e.VITE_BROKEREE_URL,
    ADDRESS_LOOKUP_URL: e.VITE_ADDRESS_LOOKUP_URL,
    EXCHANGE_RATES_URL: e.VITE_EXCHANGE_RATES_URL,
    FA2_URL: e.VITE_FA2_URL,
    SENTRY_DSN: e.VITE_SENTRY_DSN,
    RECAPTCHA_SITE_KEY_V3: e.VITE_RECAPTCHA_SITE_KEY_V3,
    HCAPTCHA_KEY: e.VITE_HCAPTCHA_KEY,
  }
}

export const loadConfig = (): AppConfig => {
  if (cached) return cached
  const raw = rawConfigSchema.parse(readEnv())
  if (import.meta.env.PROD && raw.ENV === 'development') {
    throw new Error('Development configuration detected in a production build')
  }
  if (raw.ENV === 'production') {
    const credentialUrls = [raw.API_URL, raw.AUTH_URL, raw.KEYCLOAK_URL, raw.RATES_URL]
    if (credentialUrls.some((u) => /staging|uat|localhost/i.test(u))) {
      throw new Error('Production configuration points at non-production infrastructure')
    }
  }
  cached = {
    ...raw,
    API_DATA_URL: raw.API_URL + '/nsdata',
    UPLOAD_URL: raw.API_URL + '/upload',
    PAYMENT_URL: raw.API_URL + '/payment',
    CAPTCHA_URL: raw.API_URL + '/captcha',
  }
  return cached
}

export const getConfig = (): AppConfig => {
  return loadConfig()
}
