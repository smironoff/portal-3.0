import { getHttpClient } from '@/api/client'
import { Authorize } from '@/api/httpClient'

export interface SendOtpParams {
  originCountry: number
  accountHolderFirstName: string
  accountHolderLastName: string
  preferredLanguage: number
  accountHolderEmail: string
}

export const sendOtpCode = async (params: SendOtpParams): Promise<boolean> => {
  const res = await getHttpClient().tfboCall<boolean>('emailvalidation', 'send_verification_code', params, Authorize.Yes)
  return res.payload?.[0]?.status === 'OK'
}

export const verifyOtpCode = async (otpValue: string, email: string): Promise<boolean> => {
  const res = await getHttpClient().tfboCall<boolean>(
    'emailvalidation',
    'verify_otp_code',
    { otpValue, accountHolderEmail: email },
    Authorize.Yes
  )
  return res.payload?.[0]?.status === 'OK'
}
