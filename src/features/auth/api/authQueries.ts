import { useMutation, useQuery } from '@tanstack/react-query'
import * as authApi from './authApi'

export function useLogin() {
  return useMutation({
    mutationFn: (v: { email: string; password: string; captcha: string }) =>
      authApi.login(v.email, v.password, v.captcha),
  })
}

export function useVerifyTwoFactor() {
  return useMutation({
    mutationFn: (v: { email: string; code: string }) => authApi.verifyTwoFactor(v.email, v.code),
  })
}

export function useRequestPasswordReset() {
  return useMutation({
    mutationFn: (v: { email: string; captcha: string }) => authApi.requestPasswordReset(v.email, v.captcha),
  })
}

export function useConfirmPasswordReset() {
  return useMutation({
    mutationFn: (v: { password: string; token: string; captcha: string }) =>
      authApi.confirmPasswordReset(v.password, v.token, v.captcha),
  })
}

export function useUserProfile(enabled: boolean) {
  return useQuery({ queryKey: ['userProfile'], queryFn: authApi.getUserProfile, enabled })
}
