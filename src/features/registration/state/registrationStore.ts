import { create } from 'zustand'
import type { AuthTokens } from '@/api/types'
import type { SocialProvider } from '@/features/auth/social/keycloakBroker'

export interface RegistrationDraft {
  email: string
  password: string
  originCountry: number
  preferredOrganization: number
  portalAccountDomain: string
  preferredLanguage: number
  agreeToAllTerms: boolean
  isMarketingOptOut: boolean
}

// In-memory only: holds the Keycloak id_token and tokens between the social
// callback and the social-registration screen. Never persisted to localStorage.
export interface SocialDraft {
  provider: SocialProvider
  idToken: string
  keycloakTokens: AuthTokens
  email: string
  firstName?: string
  lastName?: string
}

interface RegistrationState {
  draft: RegistrationDraft | null
  socialDraft: SocialDraft | null
  setDraft: (d: RegistrationDraft) => void
  clear: () => void
  setSocialDraft: (d: SocialDraft) => void
  clearSocial: () => void
}

// In-memory only: holds the password between the registration screen and the
// Personal Information screen. Never persisted to localStorage.
export const useRegistrationStore = create<RegistrationState>((set) => ({
  draft: null,
  socialDraft: null,
  setDraft: (draft) => set({ draft }),
  clear: () => set({ draft: null }),
  setSocialDraft: (socialDraft) => set({ socialDraft }),
  clearSocial: () => set({ socialDraft: null }),
}))
