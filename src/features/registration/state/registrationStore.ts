import { create } from 'zustand'

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

interface RegistrationState {
  draft: RegistrationDraft | null
  setDraft: (d: RegistrationDraft) => void
  clear: () => void
}

// In-memory only: holds the password between the registration screen and the
// Personal Information screen. Never persisted to localStorage.
export const useRegistrationStore = create<RegistrationState>((set) => ({
  draft: null,
  setDraft: (draft) => set({ draft }),
  clear: () => set({ draft: null }),
}))
