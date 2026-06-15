import { getHttpClient } from '@/api/client'
import { Authorize } from '@/api/httpClient'
import type { Country } from '../types'

export const getCountries = async (): Promise<Country[]> => {
  const res = await getHttpClient().tfboCall<Country[]>('utility', 'getCountries', { showUnused: false }, Authorize.No)
  return res.payload?.[0]?.result ?? []
}
