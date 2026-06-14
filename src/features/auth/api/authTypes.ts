import type { AuthTokens } from '@/api/types'

export type LoginStatus =
  | 'OK'
  | 'PENDING_APPROVAL'
  | 'PENDING_REVIEW'
  | 'PENDING_ID_ADDRESS'
  | 'PENDING_ID'
  | 'PENDING_ADDRESS'
  | 'TFA_REQUIRED'

export interface AuthResult {
  status?: LoginStatus | string
  code?: string
  tokens?: AuthTokens
  redirectURI?: string
}

export interface PasswordResetResult {
  password_reset: 'OK' | 'NOK'
}

// Login statuses that mean "credentials accepted, proceed to land".
export const LOGGED_IN_STATUSES: LoginStatus[] = [
  'OK',
  'PENDING_APPROVAL',
  'PENDING_REVIEW',
  'PENDING_ID_ADDRESS',
  'PENDING_ID',
  'PENDING_ADDRESS',
]
