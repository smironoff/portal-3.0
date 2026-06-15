import { useEffect } from 'react'
import { Stack, Typography } from '@mui/material'
import { useQueryClient } from '@tanstack/react-query'
import { LEVEL_ONE_STEPS, LEVEL_TWO_STEPS } from './flowConfig'
import { getNextStep, getPreviousStep, getStartingStep } from '../../engine/stepMachine'
import { useOnboardingStore } from '../../state/onboardingStore'
import { useQuestions, useIncrementalSubmit, useSubmitLevelOne, useSubmitLevelTwo } from '../../api/onboardingQueries'
import { useNotificationStore } from '@/state/notificationStore'
import type { ApplicationStatus } from '../../api/types'

export const SimplifiedFlow = ({ status, applicationId }: { status: ApplicationStatus; applicationId?: number }) => {
  const isLevelOne = status === 'INCOMPLETE'
  const steps = isLevelOne ? LEVEL_ONE_STEPS : LEVEL_TWO_STEPS
  const draft = useOnboardingStore((s) => s.draft)
  const currentStep = useOnboardingStore((s) => s.currentStep)
  const setCurrentStep = useOnboardingStore((s) => s.setCurrentStep)
  // TODO confirm org id source
  const questions = useQuestions(draft.organizationId as number | undefined).data ?? []
  const incremental = useIncrementalSubmit()
  const submitLevelOne = useSubmitLevelOne()
  const submitLevelTwo = useSubmitLevelTwo()
  const notify = useNotificationStore((s) => s.push)
  const queryClient = useQueryClient()

  useEffect(() => {
    setCurrentStep(getStartingStep(steps, -1, useOnboardingStore.getState().draft, questions))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status])

  // Level 2 question steps depend on the org id to resolve. Without it the
  // question machine never advances, so surface an explicit error instead.
  if (!isLevelOne && draft.organizationId == null) {
    return <Typography>We could not load the application questions. Please contact support.</Typography>
  }

  if (currentStep < 0 || currentStep >= steps.length) return <Typography>Loading...</Typography>
  const step = steps[currentStep]!
  const Comp = step.component

  const advance = async () => {
    try {
      const app = { ...useOnboardingStore.getState().draft, applicationId }
      if (step.isLast) {
        if (isLevelOne) await submitLevelOne.mutateAsync({ ...app, completed: true })
        // SimplifiedFlow has no scored appropriateness test (experience questions only),
        // so PASS is the legacy-equivalent value. TODO(compliance): confirm the backend
        // re-derives appropriateness server-side and does not trust this client value.
        else await submitLevelTwo.mutateAsync({ ...app, completed: true, appropriatenessLevel: 'PASS' })
        await queryClient.invalidateQueries({ queryKey: ['application'] })
      } else {
        await incremental.mutateAsync(app)
        setCurrentStep(getNextStep(steps, currentStep, useOnboardingStore.getState().draft))
      }
    } catch {
      notify({ severity: 'error', message: 'onboarding.error.saveFailed' })
    }
  }

  const back = () => setCurrentStep(getPreviousStep(steps, currentStep, draft))

  return (
    <Stack spacing={2}>
      <Comp onNext={advance} onBack={back} canGoBack={step.canGoBack ?? true} />
    </Stack>
  )
}
