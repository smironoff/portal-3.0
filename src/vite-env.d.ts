/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ENV?: string
  readonly VITE_API_URL: string
  readonly VITE_RATES_URL: string
  readonly VITE_AUTH_URL: string
  readonly VITE_KEYCLOAK_URL: string
  readonly VITE_KEYCLOAK_REALM: string
  readonly VITE_KEYCLOAK_CLIENT_ID: string
  readonly VITE_DEFAULT_LANGUAGE?: string
  readonly VITE_PULL_APP_STATUS_SEC?: string
  readonly VITE_PULL_NOTIFICATIONS_SEC?: string
  readonly VITE_LOGOUT_AFTER_MIN?: string
  readonly VITE_VERIFICATION_ATTEMPTS?: string
  readonly VITE_VERIFICATION_INTERVAL_SEC?: string
  readonly VITE_WTR_URL?: string
  readonly VITE_PAMM_PORTAL?: string
  readonly VITE_VENUS_API_URL?: string
  readonly VITE_BROKEREE_URL?: string
  readonly VITE_ADDRESS_LOOKUP_URL?: string
  readonly VITE_EXCHANGE_RATES_URL?: string
  readonly VITE_FA2_URL?: string
  readonly VITE_SENTRY_DSN?: string
  readonly VITE_RECAPTCHA_SITE_KEY_V3?: string
  readonly VITE_HCAPTCHA_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
