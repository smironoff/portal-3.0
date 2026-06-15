import { getHttpClient } from '@/api/client'
import { Authorize } from '@/api/httpClient'
import { tokenStore } from '@/api/tokenStore'
import type { APIResponse } from '@/api/envelope'
import type { RegisterParams, RegisterResponse } from '../types'

export class EmailAlreadyRegisteredError extends Error {
  constructor() {
    super('ALREADY_REGISTERED')
    this.name = 'EmailAlreadyRegisteredError'
  }
}

export const createLiveAccount = async (params: RegisterParams): Promise<APIResponse<RegisterResponse>> => {
  const res = await getHttpClient().tfboCall<RegisterResponse>('application', 'incremental_submit', params, Authorize.No)
  const item = res.payload?.[0]
  if (item?.status === 'ALREADY_REGISTERED') throw new EmailAlreadyRegisteredError()
  if (!item || item.status !== 'OK') {
    throw new Error(item?.message ?? `Registration failed: ${item?.status ?? 'empty response'}`)
  }
  return res
}

// The account-creating submit returns a fresh tfbo session at the envelope level
// (session_id/token); that pair authenticates subsequent tfbo calls (onboarding,
// profile). OAuth tokens, if returned, drive the Bearer header for auth/* endpoints.
export const storeRegistrationAuth = (res: APIResponse<RegisterResponse>): void => {
  if (res.session_id && res.token) tokenStore.setTfbo(res.session_id, res.token)
  const tokens = res.payload?.[0]?.result?.tokens
  if (tokens) tokenStore.setAuthTokens(tokens)
}
