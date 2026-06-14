import { getConfig } from '@/config/configStore'
import { createAuthClient, type AuthClient } from './authClient'
import { createHttpClient, type HttpClient } from './httpClient'

let httpClient: HttpClient | undefined
let authClient: AuthClient | undefined

export function getAuthClient(): AuthClient {
  if (!authClient) authClient = createAuthClient(getConfig())
  return authClient
}

export function getHttpClient(): HttpClient {
  if (!httpClient) httpClient = createHttpClient(getConfig(), getAuthClient())
  return httpClient
}
