import { describe, it, expect, vi, beforeEach } from 'vitest'

const tfboCall = vi.fn()
vi.mock('@/api/client', () => ({ getHttpClient: () => ({ tfboCall }) }))

beforeEach(() => tfboCall.mockReset())

describe('getCountries', () => {
  it('calls utility/getCountries unauthenticated and returns the result list', async () => {
    tfboCall.mockResolvedValue({ payload: [{ status: 'OK', result: [{ id: 1, name: 'Australia' }] }] })
    const { getCountries } = await import('./countriesApi')
    const { Authorize } = await import('@/api/httpClient')
    const list = await getCountries()
    expect(tfboCall).toHaveBeenCalledWith('utility', 'getCountries', { showUnused: false }, Authorize.No)
    expect(list).toEqual([{ id: 1, name: 'Australia' }])
  })

  it('returns an empty array when the payload is empty', async () => {
    tfboCall.mockResolvedValue({ payload: [] })
    const { getCountries } = await import('./countriesApi')
    expect(await getCountries()).toEqual([])
  })
})
