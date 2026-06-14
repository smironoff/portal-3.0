import { z } from 'zod'

export const rawConfigSchema = z.object({
  ENV: z.string(),
  API_URL: z.url(),
  RATES_URL: z.url(),
  AUTH_URL: z.url(),
  KEYCLOAK_URL: z.url(),
  KEYCLOAK_REALM: z.string(),
  KEYCLOAK_CLIENT_ID: z.string(),
  DEFAULT_LANGUAGE: z.string().default('en'),
  PULL_APP_STATUS_SEC: z.coerce.number().default(30),
  PULL_NOTIFICATIONS_SEC: z.coerce.number().default(300),
  LOGOUT_AFTER_MIN: z.coerce.number().default(15),
  VERIFICATION_ATTEMPTS: z.coerce.number().default(3),
  VERIFICATION_INTERVAL_SEC: z.coerce.number().default(5),
  WTR_URL: z.url().optional(),
  PAMM_PORTAL: z.url().optional(),
  VENUS_API_URL: z.url().optional(),
  BROKEREE_URL: z.string().optional(),
  ADDRESS_LOOKUP_URL: z.url().optional(),
  EXCHANGE_RATES_URL: z.url().optional(),
  FA2_URL: z.url().optional(),
  SENTRY_DSN: z.string().optional(),
  RECAPTCHA_SITE_KEY_V3: z.string().optional(),
  HCAPTCHA_KEY: z.string().optional(),
})

export type RawConfig = z.infer<typeof rawConfigSchema>

export type AppConfig = RawConfig & {
  API_DATA_URL: string
  UPLOAD_URL: string
  PAYMENT_URL: string
  CAPTCHA_URL: string
}
