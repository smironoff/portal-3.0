import { getHttpClient } from '@/api/client'
import { Authorize } from '@/api/httpClient'
import type { UserProfile } from '@/api/types'
import type { AuthResult, PasswordResetResult } from './authTypes'

export const login = (
  email: string,
  password: string,
  recaptchaResponse: string
): Promise<AuthResult> => {
  return getHttpClient().auth<AuthResult>(
    'auth/login',
    'post',
    { email, password, recaptchaResponse },
    Authorize.No
  )
}

export const verifyTwoFactor = (email: string, code: string): Promise<AuthResult> => {
  return getHttpClient().auth<AuthResult>('auth/tfa', 'post', { email, code }, Authorize.Yes, {
    skipRefresh: true,
  })
}

export const requestPasswordReset = async (
  email: string,
  recaptchaResponse: string
): Promise<boolean> => {
  const res = await getHttpClient().tfbo<PasswordResetResult>(
    {
      payload: [
        {
          module: 'authentication',
          action: 'forgot_password_web',
          email_id: email,
          response: recaptchaResponse,
        },
      ],
    },
    Authorize.No
  )
  return res.payload?.[0]?.result?.password_reset === 'OK'
}

export const confirmPasswordReset = async (
  password: string,
  token: string,
  recaptchaResponse: string
): Promise<boolean> => {
  const res = await getHttpClient().tfbo<PasswordResetResult>(
    {
      payload: [
        {
          module: 'authentication',
          action: 'forgot_password_web',
          password,
          password_reset_token: token,
          response: recaptchaResponse,
        },
      ],
    },
    Authorize.No
  )
  return res.payload?.[0]?.result?.password_reset === 'OK'
}

export const getUserProfile = async (): Promise<UserProfile> => {
  const res = await getHttpClient().tfbo<UserProfile>({
    payload: [{ module: 'profile', action: 'get_user' }],
  })
  const profile = res.payload?.[0]?.result
  if (!profile) throw new Error('Profile not found in response')
  return profile
}
