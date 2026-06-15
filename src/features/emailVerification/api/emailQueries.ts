import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { sendOtpCode, verifyOtpCode, isUserVerified, isEmailVerificationRequired } from './emailApi'
import type { SendOtpParams } from './emailApi'

export const useSendOtp = () =>
  useMutation({ mutationFn: (params: SendOtpParams) => sendOtpCode(params) })

export const useVerifyOtp = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (v: { otp: string; email: string }) => verifyOtpCode(v.otp, v.email),
    onSuccess: (ok) => {
      if (ok) {
        queryClient.invalidateQueries({ queryKey: ['application'] })
        queryClient.invalidateQueries({ queryKey: ['isUserVerified'] })
      }
    },
  })
}

export const useIsUserVerified = (email?: string) =>
  useQuery({ queryKey: ['isUserVerified', email], queryFn: () => isUserVerified(email!), enabled: !!email })

export const useIsEmailVerificationRequired = (countryId?: number) =>
  useQuery({ queryKey: ['emailVerificationRequired', countryId], queryFn: () => isEmailVerificationRequired(countryId!), enabled: countryId != null })
