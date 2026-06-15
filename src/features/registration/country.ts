import type { Country } from './types'

export interface PreferredLanguage {
  id: number
  language_code: string
}

export const domainForCountry = (country: Country): string => country.organization.name

export const organizationIdForCountry = (country: Country): number => country.organization.id

export const filterCountries = (countries: Country[]): Country[] =>
  countries
    .filter((c) => c.used !== false && c.code3 !== 'JPN')
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }))

// Ported from the legacy useLanguageID: default to English (id 1); match the current
// UI language against the backend language list (the TMJP domain forces Japanese).
// TODO(verify): wire the real preferredLanguages list; callers currently pass [] -> id 1.
export const getLanguageId = (
  country: Country | undefined,
  languages: PreferredLanguage[],
  currentLanguage: string
): number => {
  const target = country?.organization?.name === 'TMJP' ? 'ja' : currentLanguage
  const match = languages.find((l) => l.language_code === target)
  return match ? match.id : 1
}
