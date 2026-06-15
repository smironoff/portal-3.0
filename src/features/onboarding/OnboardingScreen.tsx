import { useEffect, useMemo, useRef, useState } from 'react'
import { Stack, Typography } from '@mui/material'
import { useNavigate } from '@tanstack/react-router'
import { Button } from '@/components/Button'
import { useApplication } from './api/onboardingQueries'
import { useOnboardingStore } from './state/onboardingStore'
import { SimplifiedFlow } from './flows/simplified/SimplifiedFlow'
import { GeneralFlow } from './flows/general/GeneralFlow'
import { buildAuSteps } from './flows/general/jurisdictions/au'
import { buildTmcySteps } from './flows/general/jurisdictions/tmcy'
import { buildUkSteps } from './flows/general/jurisdictions/uk'
import { JurisdictionNotAvailable } from './flows/JurisdictionNotAvailable'
import { useQuestionsList } from './flows/simplified/useQuestionsList'
import { selectFlow } from './flowSelection'
import { useApplicantCountry } from './hooks/useApplicantCountry'
import { useUserProfile } from '@/features/auth/api/authQueries'
import { useIsEmailVerificationRequired, useIsUserVerified } from '@/features/emailVerification/api/emailQueries'

const builders = { AU: buildAuSteps, TMCY: buildTmcySteps, UK: buildUkSteps } as const

const OnboardingComplete = () => {
  const navigate = useNavigate()
  const { data: profile } = useUserProfile(true)
  const required = useIsEmailVerificationRequired(profile?.country.id)
  const verified = useIsUserVerified(profile?.email)
  if (required.isLoading || verified.isLoading) {
    return <Typography>Your application is being processed.</Typography>
  }
  const needsEmail = required.data === true && verified.data !== true
  return (
    <Stack spacing={2} sx={{ maxWidth: 420 }}>
      <Typography>Your application is being processed. Document verification is the next step.</Typography>
      {needsEmail && <Button onClick={() => navigate({ to: '/account/verify-email' })}>Verify your email</Button>}
    </Stack>
  )
}

const Level1Done = ({ applicationId }: { applicationId?: number }) => {
  const [go, setGo] = useState(false)
  if (go) return <SimplifiedFlow status="LEVEL1_APPROVED" applicationId={applicationId} />
  return (
    <Stack spacing={2} sx={{ maxWidth: 420 }}>
      <Typography variant="h5">Step 1 submitted</Typography>
      <Typography>Your initial details are in review. You can continue with the remaining questions now.</Typography>
      <Button onClick={() => setGo(true)}>Continue</Button>
    </Stack>
  )
}

export const OnboardingScreen = () => {
  const { data: app, isLoading } = useApplication(true)
  const hydrate = useOnboardingStore((s) => s.hydrate)
  const draft = useOnboardingStore((s) => s.draft)
  const hydrated = useRef(false)

  // Always call hooks unconditionally (rules of hooks).
  // useQuestionsList and useMemo are only consumed in the general branch below.
  const questions = useQuestionsList()
  const country = useApplicantCountry()
  const flow = selectFlow(app ?? {}, country)
  const jurisdiction = flow.kind === 'general' ? flow.jurisdiction : 'AU'
  const steps = useMemo(() => builders[jurisdiction](questions), [jurisdiction, questions])

  useEffect(() => {
    // Hydrate only on the first load of the application so a refetch does not
    // overwrite the user's in-progress edits in the draft.
    if (app && !hydrated.current) {
      hydrate(app)
      hydrated.current = true
    }
  }, [app, hydrate])

  if (isLoading || !app) return <Typography>Loading your application...</Typography>

  const status = app.status ?? 'INCOMPLETE'
  if (status === 'DENIED' || status === 'FAILED') {
    return <Typography>Your application was not approved. Please contact support for assistance.</Typography>
  }
  if (status === 'LEVEL1_APPROVED' && !draft.completed) {
    return <Level1Done applicationId={app.applicationId} />
  }
  if (status === 'APPROVED') {
    return <Typography>Your account is approved.</Typography>
  }
  if (status === 'PENDING_KYC' || status === 'PENDING_REVIEW') {
    return <OnboardingComplete />
  }

  if (flow.kind === 'general') {
    if (questions.length === 0) return <Typography>Loading questions...</Typography>
    return <GeneralFlow steps={steps} applicationId={app.applicationId} questions={questions} />
  }

  if (flow.kind === 'unsupported') {
    return <JurisdictionNotAvailable domain={flow.domain} />
  }

  // flow.kind === 'simplified' (default / slice-1 dev behaviour)
  return <SimplifiedFlow status={status} applicationId={app.applicationId} />
}
