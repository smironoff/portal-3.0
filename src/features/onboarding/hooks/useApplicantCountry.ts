import { useUserProfile } from '@/features/auth/api/authQueries'
import { useCountries } from '@/features/registration/api/countriesQueries'
import type { Country } from '@/features/registration/types'

export const useApplicantCountry = (): Country | undefined => {
  const { data: profile } = useUserProfile(true)
  const { data: countries } = useCountries()
  if (!profile || !countries) return undefined
  return countries.find((c) => c.id === profile.country.id)
}
