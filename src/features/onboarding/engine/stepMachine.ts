import type { StepField } from './stepConfig'
import type { AppInfo, Question } from '../api/types'

export const shouldSkipStep = (step: StepField, draft: Partial<AppInfo>): boolean =>
  step.shouldDisplay ? !step.shouldDisplay(draft) : false

export const isStepCompleted = (step: StepField, draft: Partial<AppInfo>, questions: Question[]): boolean => {
  if (shouldSkipStep(step, draft)) return true

  const fieldsDone = step.fields.every((field) => {
    const v = draft[field]
    if (typeof v === 'string') return v.trim() !== ''
    return v !== undefined && v !== null
  })

  const requiredIds = (step.requiredQuestions ?? [])
    .map((label) => questions.find((q) => q.label === label)?.id)
    .filter((id): id is number => typeof id === 'number')

  const questionsDone = requiredIds.every((qid) =>
    draft.accountApplicationQuestionDetails?.some((a) => a.question === qid && a.answer !== null && a.answer !== undefined)
  )

  return fieldsDone && questionsDone
}

export const getStartingStep = (steps: StepField[], currentStep: number, draft: Partial<AppInfo>, questions: Question[]): number => {
  let next = currentStep + 1
  while (next < steps.length && isStepCompleted(steps[next]!, draft, questions)) next++
  return next
}

export const getNextStep = (steps: StepField[], currentStep: number, draft: Partial<AppInfo>): number => {
  let next = currentStep + 1
  while (next < steps.length && shouldSkipStep(steps[next]!, draft)) next++
  return next
}

export const getPreviousStep = (steps: StepField[], currentStep: number, draft: Partial<AppInfo>): number => {
  let prev = currentStep - 1
  while (prev >= 0 && shouldSkipStep(steps[prev]!, draft)) prev--
  return prev
}
