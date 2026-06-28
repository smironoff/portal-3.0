import { registerUser } from '@/features/auth/api/authApi'
import { submitLevelOne } from '@/features/onboarding/api/onboardingApi'
import { tokenStore } from '@/api/tokenStore'
import { useSessionStore } from '@/state/sessionStore'
import { socialRegister } from '@/features/auth/api/socialApi'
import type { AppInfo } from '@/features/onboarding/api/types'
import type { RegistrationDraft } from '../state/registrationStore'
import type { SocialDraft } from '../state/registrationStore'

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

export interface CreateSocialAccountInput {
  social: SocialDraft
  originCountry: number
  preferredOrganization: number
  portalAccountDomain: string
  preferredLanguage: number
  firstName: string
  lastName: string
  title: string
  agreeToAllTerms: boolean
  isMarketingOptOut: boolean
  day?: number
  month?: number
  year?: number
}

export const createSocialAccount = async (
  input: CreateSocialAccountInput
): Promise<{ applicationId: number }> => {
  // 1) Establish auth (social). The Keycloak tokens are already in hand from the
  // callback exchange; the auth-adapter trusts the id_token bearer.
  const auth = await socialRegister(input.social.idToken, {
    email_id: input.social.email,
    first_name: input.firstName,
    last_name: input.lastName,
    country: input.originCountry,
    account_holder_title: input.title,
    brand: 'ThinkMarkets',
    source: 'TP3-LiveApp',
  })
  if (auth.code && auth.status !== 'OK') {
    throw new Error(`Social registration failed: ${auth.code}`)
  }
  tokenStore.setAuthTokens(auth.tokens ?? input.social.keycloakTokens)
  useSessionStore.getState().setLoggedIn(true)

  // 2) Create the application (shared step). No password, no recaptcha on the
  // social path (the provider OAuth is the human check).
  const applicationId = await submitInitialApplication({
    accountHolderEmail: input.social.email,
    originCountry: input.originCountry,
    preferredOrganization: input.preferredOrganization,
    portalAccountDomain: input.portalAccountDomain,
    preferredLanguage: input.preferredLanguage,
    accountHolderFirstName: input.firstName,
    accountHolderLastName: input.lastName,
    accountHolderTitle: input.title,
    ...(input.day ? { accountHolderDayOfBirth: input.day } : {}),
    ...(input.month ? { accountHolderMonthOfBirth: input.month } : {}),
    ...(input.year ? { accountHolderYearOfBirth: input.year } : {}),
    agreeToAllTerms: input.agreeToAllTerms,
    isMarketingOptOut: input.isMarketingOptOut,
    accountType: 'individual',
    accountTradingTypes: [1],
    brand: 'ThinkMarkets',
    source: 'TP3-LiveApp',
  })
  return { applicationId }
}
