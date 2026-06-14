import { rawConfigSchema } from './schema'
import type { AppConfig } from './schema'

let cached: AppConfig | undefined

export async function loadConfig(): Promise<AppConfig> {
  if (cached) return cached
  // Always the same file: one build is promoted across environments.
  let res: Response
  try {
    res = await fetch(`/config.json?v=${Date.now()}`)
  } catch (e) {
    throw new Error(`Error fetching configuration from server: ${(e as Error).message}`, { cause: e })
  }
  if (!res.ok) throw new Error('Error fetching configuration from server')
  const raw = rawConfigSchema.parse(await res.json())
  cached = {
    ...raw,
    API_DATA_URL: raw.API_URL + '/nsdata',
    UPLOAD_URL: raw.API_URL + '/upload',
    PAYMENT_URL: raw.API_URL + '/payment',
    CAPTCHA_URL: raw.API_URL + '/captcha',
  }
  return cached
}

export function getConfig(): AppConfig {
  if (!cached) throw new Error('Config accessed before loadConfig() resolved')
  return cached
}
