import { useEffect, useState } from 'react'
import { Stack, Typography } from '@mui/material'
import { Button } from '@/components/Button'
import { useApplication } from './api/onboardingQueries'
import { useOnboardingStore } from './state/onboardingStore'
import { SimplifiedFlow } from './flows/simplified/SimplifiedFlow'

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

  useEffect(() => {
    if (app) hydrate(app)
  }, [app, hydrate])

  if (isLoading || !app) return <Typography>Loading your application...</Typography>

  const status = app.status ?? 'INCOMPLETE'
  if (status === 'LEVEL1_APPROVED' && !draft.completed) {
    return <Level1Done applicationId={app.applicationId} />
  }
  if (status === 'PENDING_KYC' || status === 'PENDING_REVIEW' || status === 'APPROVED') {
    return <Typography>Your application is being processed. Document verification is the next step.</Typography>
  }
  return <SimplifiedFlow status={status} applicationId={app.applicationId} />
}
