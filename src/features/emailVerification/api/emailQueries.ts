import { useMutation, useQueryClient } from '@tanstack/react-query'
import { sendOtpCode, verifyOtpCode } from './emailApi'
import type { SendOtpParams } from './emailApi'

export const useSendOtp = () =>
  useMutation({ mutationFn: (params: SendOtpParams) => sendOtpCode(params) })

export const useVerifyOtp = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (v: { otp: string; email: string }) => verifyOtpCode(v.otp, v.email),
    onSuccess: (ok) => {
      if (ok) queryClient.invalidateQueries({ queryKey: ['application'] })
    },
  })
}
