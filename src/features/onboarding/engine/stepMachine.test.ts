import { describe, it, expect } from 'vitest'
import { isStepCompleted, getStartingStep, getNextStep, getPreviousStep } from './stepMachine'
import type { StepField } from './stepConfig'
import type { Question } from '../api/types'

const noop = (() => null) as unknown as StepField['component']
const step = (over: Partial<StepField>): StepField => ({ fields: [], component: noop, category: 'personal', ...over })

const questions: Question[] = [{ id: 7, question: 'Forex?', label: 'forexExperience', answers: [{ id: 1, answer: 'yes', label: 'yes' }] }]

describe('isStepCompleted', () => {
  it('is true when all fields are filled', () => {
    const s = step({ fields: ['accountHolderFirstName'] })
    expect(isStepCompleted(s, { accountHolderFirstName: 'Jo' }, [])).toBe(true)
    expect(isStepCompleted(s, {}, [])).toBe(false)
  })
  it('treats empty/whitespace strings as incomplete', () => {
    const s = step({ fields: ['accountHolderFirstName'] })
    expect(isStepCompleted(s, { accountHolderFirstName: '   ' }, [])).toBe(false)
  })
  it('requires required questions to be answered (by mapped id)', () => {
    const s = step({ fields: [], requiredQuestions: ['forexExperience'] })
    expect(isStepCompleted(s, {}, questions)).toBe(false)
    expect(isStepCompleted(s, { accountApplicationQuestionDetails: [{ question: 7, answer: 1 }] }, questions)).toBe(true)
  })
  it('is complete when the step is skipped via shouldDisplay', () => {
    const s = step({ fields: ['accountHolderFirstName'], shouldDisplay: () => false })
    expect(isStepCompleted(s, {}, [])).toBe(true)
  })
})

describe('navigation', () => {
  const steps: StepField[] = [
    step({ fields: ['accountHolderFirstName'] }),
    step({ fields: ['accountHolderPhone'], shouldDisplay: () => false }),
    step({ fields: ['accountHolderPostalCode'] }),
  ]
  it('getStartingStep skips already-completed steps', () => {
    expect(getStartingStep(steps, -1, { accountHolderFirstName: 'Jo' }, [])).toBe(2)
  })
  it('getNextStep skips non-displayed steps', () => {
    expect(getNextStep(steps, 0, {})).toBe(2)
  })
  it('getPreviousStep skips non-displayed steps', () => {
    expect(getPreviousStep(steps, 2, {})).toBe(0)
  })
})
