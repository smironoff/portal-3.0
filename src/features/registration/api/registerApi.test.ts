import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { APIResponse } from '@/api/envelope'
import type { RegisterResponse } from '../types'

const tfboCall = vi.fn()
const setTfbo = vi.fn()
const setAuthTokens = vi.fn()
vi.mock('@/api/client', () => ({ getHttpClient: () => ({ tfboCall }) }))
vi.mock('@/api/tokenStore', () => ({ tokenStore: { setTfbo, setAuthTokens } }))

beforeEach(() => {
  tfboCall.mockReset()
  setTfbo.mockReset()
  setAuthTokens.mockReset()
})

const params = {
  accountHolderEmail: 'a@b.com', accountHolderPassword: 'Secret12', originCountry: 1,
  preferredOrganization: 7, portalAccountDomain: 'AU', agreeToAllTerms: true,
  isMarketingOptOut: true, accountType: 'individual' as const, source: 'TP3-LiveApp',
  brand: 'ThinkMarkets' as const, preferredLanguage: 1, recaptchaResponse: 'cap',
}

describe('createLiveAccount', () => {
  it('submits incremental_submit unauthenticated and returns the envelope', async () => {
    tfboCall.mockResolvedValue({ session_id: 's', token: 't', payload: [{ status: 'OK', result: { applicationId: 9 } }] })
    const { createLiveAccount } = await import('./registerApi')
    const { Authorize } = await import('@/api/httpClient')
    const res = await createLiveAccount(params)
    expect(tfboCall).toHaveBeenCalledWith('application', 'incremental_submit', params, Authorize.No)
    expect(res.payload[0].result.applicationId).toBe(9)
  })

  it('throws EmailAlreadyRegisteredError on ALREADY_REGISTERED', async () => {
    tfboCall.mockResolvedValue({ payload: [{ status: 'ALREADY_REGISTERED' }] })
    const { createLiveAccount, EmailAlreadyRegisteredError } = await import('./registerApi')
    await expect(createLiveAccount(params)).rejects.toBeInstanceOf(EmailAlreadyRegisteredError)
  })

  it('throws on a non-OK status', async () => {
    tfboCall.mockResolvedValue({ payload: [{ status: 'SYS_ERR', message: 'boom' }] })
    const { createLiveAccount } = await import('./registerApi')
    await expect(createLiveAccount(params)).rejects.toThrow('boom')
  })
})

describe('storeRegistrationAuth', () => {
  it('stores the envelope tfbo session and any OAuth tokens', async () => {
    const { storeRegistrationAuth } = await import('./registerApi')
    const res1: APIResponse<RegisterResponse> = {
      id: 1, session_id: 's', token: 't',
      payload: [{ module: 'application', action: 'incremental_submit', status: 'OK', result: { tokens: { accessToken: 'a', refreshToken: 'r', refreshTokenValidUntil: '2030' } } }],
    }
    storeRegistrationAuth(res1)
    expect(setTfbo).toHaveBeenCalledWith('s', 't')
    expect(setAuthTokens).toHaveBeenCalledWith({ accessToken: 'a', refreshToken: 'r', refreshTokenValidUntil: '2030' })
  })

  it('stores only the tfbo session when no OAuth tokens are returned', async () => {
    const { storeRegistrationAuth } = await import('./registerApi')
    const res2: APIResponse<RegisterResponse> = {
      id: 1, session_id: 's', token: 't',
      payload: [{ module: 'application', action: 'incremental_submit', status: 'OK', result: {} }],
    }
    storeRegistrationAuth(res2)
    expect(setTfbo).toHaveBeenCalledWith('s', 't')
    expect(setAuthTokens).not.toHaveBeenCalled()
  })
})
