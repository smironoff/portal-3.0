import type { AuthTokens } from '@/api/types'

export interface Organization {
  id: number
  name: string
  guid?: string
  defaultLeverage?: string
}

export interface Country {
  id: number
  name: string
  code2: string
  code3: string
  phoneCode: number
  european: boolean
  used?: boolean
  organization: Organization
}

export interface RegisterParams {
  accountHolderEmail: string
  accountHolderPassword: string
  originCountry: number
  preferredOrganization: number
  portalAccountDomain: string
  agreeToAllTerms: boolean
  isMarketingOptOut: boolean
  accountType: 'individual'
  source: string
  brand: 'ThinkMarkets'
  preferredLanguage: number
  afsAid?: string
  utmLink?: string
  visitorId?: string
  referrerId?: string
  recaptchaResponse: string
}

export interface RegisterResponse {
  sso_token?: string
  token?: string
  applicationId?: number
  app_id?: number
  applicationStatus?: string
  tokens?: AuthTokens
}
