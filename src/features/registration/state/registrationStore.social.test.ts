import { describe, it, expect, beforeEach } from 'vitest'
import { useRegistrationStore, type SocialDraft } from './registrationStore'

const sample: SocialDraft = {
  provider: 'apple',
  idToken: 'IT',
  keycloakTokens: { accessToken: 'a', refreshToken: 'r', idToken: 'IT', refreshTokenValidUntil: '2030' },
  email: 'a@b.com',
}

describe('registrationStore social draft', () => {
  beforeEach(() => useRegistrationStore.getState().clearSocial())

  it('sets and clears the social draft', () => {
    useRegistrationStore.getState().setSocialDraft(sample)
    expect(useRegistrationStore.getState().socialDraft).toEqual(sample)
    useRegistrationStore.getState().clearSocial()
    expect(useRegistrationStore.getState().socialDraft).toBeNull()
  })
})
