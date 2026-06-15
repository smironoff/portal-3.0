import { describe, it, expect, vi } from 'vitest'
import { renderHook } from '@testing-library/react'

const rich = { id: 1, name: 'Australia', code2: 'AU', code3: 'AUS', phoneCode: 61, european: false, organization: { id: 7, name: 'AU' }, isSimplifyOnboarding: false }

const { mockUseUserProfile, mockUseCountries } = vi.hoisted(() => ({
  mockUseUserProfile: vi.fn(),
  mockUseCountries: vi.fn(),
}))

vi.mock('@/features/auth/api/authQueries', () => ({ useUserProfile: mockUseUserProfile }))
vi.mock('@/features/registration/api/countriesQueries', () => ({ useCountries: mockUseCountries }))

describe('useApplicantCountry', () => {
  it('returns the full Country object matching profile.country.id', async () => {
    mockUseUserProfile.mockReturnValue({ data: { country: { id: 1 }, email: 'a@b.com' } })
    mockUseCountries.mockReturnValue({ data: [rich] })
    const { useApplicantCountry } = await import('./useApplicantCountry')
    const { result } = renderHook(() => useApplicantCountry())
    expect(result.current?.organization.name).toBe('AU')
  })

  it('returns undefined when profile is not yet loaded', async () => {
    mockUseUserProfile.mockReturnValue({ data: undefined })
    mockUseCountries.mockReturnValue({ data: [rich] })
    const { useApplicantCountry } = await import('./useApplicantCountry')
    const { result } = renderHook(() => useApplicantCountry())
    expect(result.current).toBeUndefined()
  })
})
