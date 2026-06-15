import { describe, it, expect, vi } from 'vitest'
import { renderHook } from '@testing-library/react'

const rich = { id: 1, name: 'Australia', code2: 'AU', code3: 'AUS', phoneCode: 61, european: false, organization: { id: 7, name: 'AU' }, isSimplifyOnboarding: false }
vi.mock('@/features/auth/api/authQueries', () => ({ useUserProfile: () => ({ data: { country: { id: 1 }, email: 'a@b.com' } }) }))
vi.mock('@/features/registration/api/countriesQueries', () => ({ useCountries: () => ({ data: [rich] }) }))

describe('useApplicantCountry', () => {
  it('resolves the rich country by profile.country.id', async () => {
    const { useApplicantCountry } = await import('./useApplicantCountry')
    const { result } = renderHook(() => useApplicantCountry())
    expect(result.current?.organization.name).toBe('AU')
  })
})
