import { registerUser } from '@/features/auth/api/authApi'
import { submitLevelOne } from '@/features/onboarding/api/onboardingApi'
import { tokenStore } from '@/api/tokenStore'
import { useSessionStore } from '@/state/sessionStore'
import type { AppInfo } from '@/features/onboarding/api/types'
import type { RegistrationDraft } from '../state/registrationStore'

export type CreateSimplifiedAccountInput = RegistrationDraft & {
  firstName: string
  lastName: string
  day: number
  month: number
  year: number
  title: string
  recaptchaResponse: string
}

// Shared with Phase B (social): creates the application once auth is established.
export const submitInitialApplication = async (payload: Partial<AppInfo>): Promise<number> => {
  const res = await submitLevelOne(payload)
  return res.applicationId
}

export const createSimplifiedAccount = async (
  input: CreateSimplifiedAccountInput
): Promise<{ applicationId: number }> => {
  // 1) Establish auth (email/password). Phase B swaps this for a social exchange.
  const auth = await registerUser({
    email_id: input.email,
    password: input.password,
    first_name: input.firstName,
    last_name: input.lastName,
    country: input.originCountry,
    account_holder_title: input.title,
    preferred_language_code: 'en',
    brand: 'ThinkMarkets',
    source: 'TP3-LiveApp',
  })
  if (auth.status !== 'OK' || !auth.tokens) {
    throw new Error(`Registration failed: ${auth.code ?? auth.status ?? 'unknown'}`)
  }
  tokenStore.setAuthTokens(auth.tokens)
  useSessionStore.getState().setLoggedIn(true)

  // 2) Create the application (shared step).
  const applicationId = await submitInitialApplication({
    accountHolderEmail: input.email,
    accountHolderPassword: input.password,
    originCountry: input.originCountry,
    preferredOrganization: input.preferredOrganization,
    portalAccountDomain: input.portalAccountDomain,
    preferredLanguage: input.preferredLanguage,
    accountHolderFirstName: input.firstName,
    accountHolderLastName: input.lastName,
    accountHolderDayOfBirth: input.day,
    accountHolderMonthOfBirth: input.month,
    accountHolderYearOfBirth: input.year,
    accountHolderTitle: input.title,
    agreeToAllTerms: input.agreeToAllTerms,
    isMarketingOptOut: input.isMarketingOptOut,
    accountType: 'individual',
    accountTradingTypes: [1],
    brand: 'ThinkMarkets',
    source: 'TP3-LiveApp',
    recaptchaResponse: input.recaptchaResponse,
  })
  return { applicationId }
}
