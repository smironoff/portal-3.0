import { describe, it, expect, beforeEach } from 'vitest'
import { useRegistrationStore } from './registrationStore'

const sample = {
  email: 'a@b.com', password: 'Think123!', originCountry: 158, preferredOrganization: 14,
  portalAccountDomain: 'TMLC', preferredLanguage: 1, agreeToAllTerms: true, isMarketingOptOut: true,
}

describe('registrationStore', () => {
  beforeEach(() => useRegistrationStore.getState().clear())

  it('starts empty', () => {
    expect(useRegistrationStore.getState().draft).toBeNull()
  })
  it('stores and clears the draft', () => {
    useRegistrationStore.getState().setDraft(sample)
    expect(useRegistrationStore.getState().draft?.originCountry).toBe(158)
    useRegistrationStore.getState().clear()
    expect(useRegistrationStore.getState().draft).toBeNull()
  })
})
