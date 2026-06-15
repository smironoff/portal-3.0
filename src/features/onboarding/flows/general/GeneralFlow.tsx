import { useEffect, useState } from 'react'
import { Stack, Typography } from '@mui/material'
import { getNextStep, getPreviousStep, getStartingStep } from '../../engine/stepMachine'
import { useOnboardingStore } from '../../state/onboardingStore'
import { useIncrementalSubmit } from '../../api/onboardingQueries'
import { useNotificationStore } from '@/state/notificationStore'
import { useQueryClient } from '@tanstack/react-query'
import type { StepField } from '../../engine/stepConfig'
import type { AppInfo, Question } from '../../api/types'

const CONTINUE_STATUSES = ['INCOMPLETE', 'PENDING_APPROPRIATENESS_TEST']

export const GeneralFlow = ({
  steps,
  applicationId,
  questions,
}: {
  steps: StepField[]
  applicationId?: number
  questions: Question[]
}) => {
  const draft = useOnboardingStore((s) => s.draft)
  const currentStep = useOnboardingStore((s) => s.currentStep)
  const setCurrentStep = useOnboardingStore((s) => s.setCurrentStep)
  const patch = useOnboardingStore((s) => s.patch)
  const incremental = useIncrementalSubmit()
  const notify = useNotificationStore((s) => s.push)
  const queryClient = useQueryClient()
  const [failed, setFailed] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    const nonFailureSteps = steps.filter((s) => !s.isFailure)
    const computed = getStartingStep(nonFailureSteps, -1, useOnboardingStore.getState().draft, questions)
    const targetStep = nonFailureSteps[computed]
    // If getStartingStep overshoots (all steps look complete on a fresh draft), default to 0.
    const start = targetStep != null ? steps.indexOf(targetStep) : 0
    setCurrentStep(start)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [steps.length])

  if (failed) {
    const failStep = steps.find((s) => s.isFailure)
    if (failStep) {
      const F = failStep.component
      return <F onNext={() => {}} canGoBack={false} />
    }
  }

  if (currentStep < 0 || currentStep >= steps.length) return <Typography>Loading...</Typography>
  const step = steps[currentStep]!
  if (step.isFailure) return <Typography>Loading...</Typography>
  const Comp = step.component

  const advance = async () => {
    // Guard against re-entrant submits while a mutation is in flight.
    if (submitting) return
    setSubmitting(true)
    try {
      let app: Partial<AppInfo> = { ...useOnboardingStore.getState().draft, applicationId }
      // Only treat FAIL as failure when set by THIS submit's beforeSubmit; reading
      // app.appropriatenessLevel could carry a STALE FAIL from a hydrated draft.
      let computedLevel: string | undefined
      if (step.beforeSubmit) {
        const scored = await step.beforeSubmit(app, questions)
        computedLevel = scored.appropriatenessLevel
        app = scored
        // Persist beforeSubmit result before the network call (existing behaviour).
        patch(app)
      }
      const res = await incremental.mutateAsync(step.isLast ? { ...app, completed: true } : app)
      const status = res.applicationStatus
      if (!CONTINUE_STATUSES.includes(status) || computedLevel === 'FAIL') {
        setFailed(true)
        return
      }
      if (step.isLast) {
        await queryClient.invalidateQueries({ queryKey: ['application'] })
        return
      }
      // Use the patched draft for next-step navigation; skip isFailure steps.
      const next = getNextStep(steps, currentStep, useOnboardingStore.getState().draft)
      const nextStep = steps[next]
      setCurrentStep(nextStep?.isFailure === true ? getNextStep(steps, next, useOnboardingStore.getState().draft) : next)
    } catch {
      notify({ severity: 'error', message: 'onboarding.error.saveFailed' })
    } finally {
      setSubmitting(false)
    }
  }

  const back = () => setCurrentStep(getPreviousStep(steps, currentStep, draft))

  return (
    <Stack spacing={2}>
      <Comp onNext={advance} onBack={back} canGoBack={step.canGoBack ?? true} />
    </Stack>
  )
}
