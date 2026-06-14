export type AuthTokens = {
  accessToken: string
  refreshToken: string
  idToken?: string
  refreshTokenValidUntil: string
}

export type Currency = { id: number; code: string; name?: string; symbol?: string }

export type Country = {
  id: number
  name: string
  code2: string
  code3: string
  phoneCode: number
  european: boolean
}

export type UserProfile = {
  id: number
  firstName: string
  lastName: string
  fullName: string
  email: string
  cif: string
  brand: string
  country: Country
  approved: boolean
  preferredLanguage: { code: string; name?: string } | string
  additionalAttributes?: {
    inactivityTimeout?: string // minutes, as a string
    [key: string]: unknown
  }
}
