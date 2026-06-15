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

  const advance = async (override?: Partial<AppInfo>) => {
    if (submitting) return
    setSubmitting(true)
    try {
      let app: Partial<AppInfo> = { ...useOnboardingStore.getState().draft, applicationId, ...override }
      let computedLevel: string | undefined = override?.appropriatenessLevel
      if (step.beforeSubmit) {
        app = await step.beforeSubmit(app, questions)
        computedLevel = app.appropriatenessLevel
      }
      patch(app)
      const res = await incremental.mutateAsync(step.isLast ? { ...app, completed: true } : app)
      if (!CONTINUE_STATUSES.includes(res.applicationStatus) || computedLevel === 'FAIL') {
        setFailed(true)
        return
      }
      if (step.isLast) {
        await queryClient.invalidateQueries({ queryKey: ['application'] })
        return
      }
      setCurrentStep(getNextStep(steps, currentStep, useOnboardingStore.getState().draft))
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
