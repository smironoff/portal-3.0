import { describe, it, expect } from 'vitest'
import { domainForCountry, organizationIdForCountry, filterCountries, getLanguageId } from './country'
import type { Country } from './types'

const mk = (over: Partial<Country> & { id: number; name: string; code3: string }): Country => ({
  code2: '', phoneCode: 0, european: false,
  organization: { id: 10, name: 'AU' },
  ...over,
})

describe('country helpers', () => {
  it('maps domain and organization id from the organization', () => {
    const c = mk({ id: 1, name: 'Australia', code3: 'AUS', organization: { id: 7, name: 'AU' } })
    expect(domainForCountry(c)).toBe('AU')
    expect(organizationIdForCountry(c)).toBe(7)
  })

  it('excludes Japan, drops unused, and sorts by name', () => {
    const list = [
      mk({ id: 1, name: 'Zambia', code3: 'ZMB' }),
      mk({ id: 2, name: 'Japan', code3: 'JPN' }),
      mk({ id: 3, name: 'Albania', code3: 'ALB' }),
      mk({ id: 4, name: 'Narnia', code3: 'NAR', used: false }),
    ]
    expect(filterCountries(list).map((c) => c.code3)).toEqual(['ALB', 'ZMB'])
  })

  it('getLanguageId defaults to English (1) and matches the current language', () => {
    const c = mk({ id: 1, name: 'Australia', code3: 'AUS', organization: { id: 7, name: 'AU' } })
    expect(getLanguageId(c, [], 'en')).toBe(1)
    expect(getLanguageId(c, [{ id: 5, language_code: 'de' }], 'de')).toBe(5)
  })

  it('getLanguageId forces Japanese for the TMJP domain', () => {
    const c = mk({ id: 1, name: 'Japan2', code3: 'XXX', organization: { id: 9, name: 'TMJP' } })
    expect(getLanguageId(c, [{ id: 8, language_code: 'ja' }], 'en')).toBe(8)
  })
})
