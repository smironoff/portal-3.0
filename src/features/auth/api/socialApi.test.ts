import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/config/configStore', () => ({ getConfig: () => ({ AUTH_URL: 'https://auth.test' }) }))

import { checkProfileStatus, socialRegister } from './socialApi'

describe('socialApi', () => {
  beforeEach(() => vi.restoreAllMocks())

  it('checkProfileStatus GETs with the id_token bearer', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ needsCompletion: true }) })
    vi.stubGlobal('fetch', fetchMock)
    const status = await checkProfileStatus('ID-TOKEN')
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://auth.test/auth/profile/status')
    expect(init.method).toBe('GET')
    expect(init.headers.Authorization).toBe('Bearer ID-TOKEN')
    expect(status).toEqual({ needsCompletion: true })
  })

  it('checkProfileStatus throws when not ok', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 401, json: async () => ({}) }))
    await expect(checkProfileStatus('x')).rejects.toThrow('Profile status failed (HTTP 401)')
  })

  it('socialRegister POSTs the bearer id_token body with no password', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'OK', tokens: { accessToken: 'a', refreshToken: 'r', refreshTokenValidUntil: '2030' } }),
    })
    vi.stubGlobal('fetch', fetchMock)
    const result = await socialRegister('ID-TOKEN', {
      email_id: 'a@b.com',
      first_name: 'Ada',
      last_name: 'Lovelace',
      country: 158,
      account_holder_title: 'Mr',
      brand: 'ThinkMarkets',
      source: 'TP3-LiveApp',
    })
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://auth.test/auth/register')
    expect(init.method).toBe('POST')
    expect(init.headers.Authorization).toBe('Bearer ID-TOKEN')
    const body = JSON.parse(init.body as string)
    expect(body).toEqual({
      email_id: 'a@b.com',
      first_name: 'Ada',
      last_name: 'Lovelace',
      country: 158,
      account_holder_title: 'Mr',
      brand: 'ThinkMarkets',
      source: 'TP3-LiveApp',
    })
    expect(body.password).toBeUndefined()
    expect(result.status).toBe('OK')
  })
})
