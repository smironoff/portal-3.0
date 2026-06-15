import { useMutation } from '@tanstack/react-query'
import { sendOtpCode, verifyOtpCode } from './emailApi'
import type { SendOtpParams } from './emailApi'

export const useSendOtp = () =>
  useMutation({ mutationFn: (params: SendOtpParams) => sendOtpCode(params) })

export const useVerifyOtp = () =>
  useMutation({ mutationFn: (v: { otp: string; email: string }) => verifyOtpCode(v.otp, v.email) })
