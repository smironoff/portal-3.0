import { useEffect, useRef } from 'react'
import { Stack, Typography } from '@mui/material'
import { useNavigate } from '@tanstack/react-router'
import { Button } from '@/components/Button'
import { OtpInput } from './components/OtpInput'
import { useSendOtp, useVerifyOtp } from './api/emailQueries'
import { useUserProfile } from '@/features/auth/api/authQueries'
import { useNotificationStore } from '@/state/notificationStore'
import { resolveLandingRoute } from '@/features/auth/landing'
import type { SendOtpParams } from './api/emailApi'

export const EmailVerificationScreen = () => {
  const { data: profile } = useUserProfile(true)
  const send = useSendOtp()
  const verify = useVerifyOtp()
  const navigate = useNavigate()
  const notify = useNotificationStore((s) => s.push)
  const sent = useRef(false)

  // The profile carries a language code, not the numeric id this endpoint expects;
  // default to English (id 1) as the legacy flow does. TODO(verify): map code -> id.
  const sendParams = (): SendOtpParams | undefined =>
    profile && {
      originCountry: profile.country.id,
      accountHolderFirstName: profile.firstName,
      accountHolderLastName: profile.lastName,
      preferredLanguage: 1,
      accountHolderEmail: profile.email,
    }

  useEffect(() => {
    const params = sendParams()
    if (params && !sent.current) {
      sent.current = true
      send.mutate(params)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile])

  if (!profile) return <Typography>Loading...</Typography>

  const onComplete = async (otp: string) => {
    const ok = await verify.mutateAsync({ otp, email: profile.email }).catch(() => false)
    if (ok) {
      notify({ severity: 'success', message: 'Email verified' })
      navigate({ to: resolveLandingRoute(profile) })
    } else {
      notify({ severity: 'error', message: 'Invalid or expired code' })
    }
  }

  return (
    <Stack spacing={3} sx={{ maxWidth: 420, mx: 'auto', mt: 4 }}>
      <Typography variant="h4">Verify your email</Typography>
      <Typography>We sent a 6-digit code to {profile.email}.</Typography>
      <OtpInput onComplete={onComplete} />
      <Button variant="text" disabled={send.isPending} onClick={() => { const p = sendParams(); if (p) send.mutate(p) }}>
        Resend code
      </Button>
    </Stack>
  )
}
