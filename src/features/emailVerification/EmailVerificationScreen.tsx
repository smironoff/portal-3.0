import { useEffect, useRef, useState } from 'react'
import { Stack, Typography } from '@mui/material'
import { Button } from '@/components/Button'
import { OtpInput } from './components/OtpInput'
import { useSendOtp, useVerifyOtp, useIsUserVerified } from './api/emailQueries'
import { useUserProfile } from '@/features/auth/api/authQueries'
import { useNotificationStore } from '@/state/notificationStore'
import type { SendOtpParams } from './api/emailApi'

export const EmailVerificationScreen = () => {
  const { data: profile } = useUserProfile(true)
  const send = useSendOtp()
  const verify = useVerifyOtp()
  const notify = useNotificationStore((s) => s.push)
  const alreadyVerified = useIsUserVerified(profile?.email)
  const sent = useRef(false)
  const [verified, setVerified] = useState(false)
  const isVerified = verified || alreadyVerified.data === true

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
    if (params && !sent.current && alreadyVerified.data === false) {
      sent.current = true
      send.mutate(params)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, alreadyVerified.data])

  if (!profile) return <Typography>Loading...</Typography>

  if (isVerified) {
    return (
      <Stack spacing={2} sx={{ maxWidth: 420, mx: 'auto', mt: 4 }}>
        <Typography variant="h4">Email verified</Typography>
        <Typography>Thank you. Your email address has been confirmed and your application is being processed.</Typography>
      </Stack>
    )
  }

  if (alreadyVerified.isLoading) return <Typography>Loading...</Typography>

  const onComplete = async (otp: string) => {
    try {
      const ok = await verify.mutateAsync({ otp, email: profile.email })
      if (ok) {
        setVerified(true)
        notify({ severity: 'success', message: 'Email verified' })
      } else {
        notify({ severity: 'error', message: 'Invalid or expired code' })
      }
    } catch {
      notify({ severity: 'error', message: 'Something went wrong. Please try again.' })
    }
  }

  return (
    <Stack spacing={3} sx={{ maxWidth: 420, mx: 'auto', mt: 4 }}>
      <Typography variant="h4">Verify your email</Typography>
      <Typography>We sent a 6-digit code to {profile.email}.</Typography>
      {(send.isError || send.data === false) && (
        <Typography color="error">We could not send a verification code. Please use Resend below.</Typography>
      )}
      <OtpInput onComplete={onComplete} />
      <Button variant="text" disabled={send.isPending} onClick={() => { const p = sendParams(); if (p) send.mutate(p) }}>
        Resend code
      </Button>
    </Stack>
  )
}
