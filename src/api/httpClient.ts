import type { AppConfig } from '@/config/schema'
import type { APIResponse } from './envelope'
import type { AuthClient } from './authClient'
import { tokenStore } from './tokenStore'
import { SessionExpiredError } from './errors'

export const Authorize = {
  Yes: 0,
  No: 1,
} as const

export type Authorize = (typeof Authorize)[keyof typeof Authorize]

interface TfboRequest {
  payload: Array<{ module: string; action: string; [k: string]: unknown }>
  session_id?: string
  token?: string
}

export interface HttpClient {
  request: <T>(url: string, method: string, auth: Authorize, data?: unknown) => Promise<T>
  tfbo: <T>(data: TfboRequest, auth?: Authorize) => Promise<APIResponse<T>>
  auth: <T>(path: string, method: string, data?: unknown, auth?: Authorize) => Promise<T>
}

export function createHttpClient(config: AppConfig, authClient: AuthClient): HttpClient {
  async function request<T>(
    url: string,
    method: string,
    auth: Authorize,
    data?: unknown
  ): Promise<T> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (auth === Authorize.Yes) headers.Authorization = `Bearer ${tokenStore.getAccessToken()}`
    const res = await fetch(url, {
      method,
      headers,
      credentials: 'include',
      body: data ? JSON.stringify(data) : undefined,
    })
    return res.json() as Promise<T>
  }

  async function tfbo<T>(
    data: TfboRequest,
    auth: Authorize = Authorize.Yes
  ): Promise<APIResponse<T>> {
    const send = () => {
      const body: TfboRequest = { ...data }
      if (auth === Authorize.Yes) {
        body.session_id = tokenStore.getTfboSession()
        body.token = tokenStore.getTfboToken()
      }
      return request<APIResponse<T>>(config.API_DATA_URL, 'post', auth, body)
    }
    const res = await send()
    if (auth === Authorize.Yes && res.payload?.[0]?.status === 'NOT_AUTHORIZED') {
      if (await authClient.refreshOnce()) return send()
      authClient.notifyExpired()
      throw new SessionExpiredError()
    }
    return res
  }

  async function authRequest<T>(
    path: string,
    method: string,
    data?: unknown,
    a: Authorize = Authorize.Yes
  ): Promise<T> {
    const send = () =>
      request<T & { code?: string; status?: string }>(`${config.AUTH_URL}/${path}`, method, a, data)
    const res = await send()
    if (a === Authorize.Yes && res.code && res.status !== 'OK') {
      if (await authClient.refreshOnce()) return send()
      authClient.notifyExpired()
      throw new SessionExpiredError()
    }
    return res
  }

  return { request, tfbo, auth: authRequest }
}
