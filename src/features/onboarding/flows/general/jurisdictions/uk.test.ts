import { describe, it, expect } from 'vitest'
import { buildUkSteps } from './uk'
import type { Question } from '../../../api/types'

const q = (id: number, label: string): Question => ({
  id, question: label, label, isMandatory: true, answers: [
    { id: id * 10 + 1, answer: 'never', label: 'never', score: 0 },
    { id: id * 10 + 2, answer: 'lots', label: 'moreThan60Trades', score: 3 },
  ],
})
const questions: Question[] = [
  q(1, 'forexExperience'), q(2, 'sharesFundsExperience'), q(3, 'personalProfit'),
  q(4, 'useLeverage'), q(5, 'unwantedMarketMovements'), q(6, 'appleUseLeverage'), q(7, 'UKDepositLoss'),
]

describe('buildUkSteps', () => {
  it('has forexExperience (with beforeSubmit), a Refer step, terms (isLast), failure (isFailure)', () => {
    const steps = buildUkSteps(questions)
    const forex = steps.find((s) => s.requiredQuestions?.includes('forexExperience'))!
    expect(typeof forex.beforeSubmit).toBe('function')
    expect(steps.find((s) => s.category === 'refer')?.shouldDisplay?.({ appropriatenessLevel: 'REFER' })).toBe(true)
    expect(steps.some((s) => s.isLast)).toBe(true)
    expect(steps.some((s) => s.isFailure)).toBe(true)
  })

  it('forexExperience auto-pass sets PASS; never leaves it undefined; appleUseLeverage scores', async () => {
    const steps = buildUkSteps(questions)
    const forex = steps.find((s) => s.requiredQuestions?.includes('forexExperience'))!
    expect((await forex.beforeSubmit!({ accountApplicationQuestionDetails: [{ question: 1, answer: 12 }] }, questions)).appropriatenessLevel).toBe('PASS')
    expect((await forex.beforeSubmit!({ accountApplicationQuestionDetails: [{ question: 1, answer: 11 }] }, questions)).appropriatenessLevel).toBeUndefined()

    const apple = steps.find((s) => s.requiredQuestions?.includes('appleUseLeverage'))!
    const details = [
      { question: 1, answer: 11 }, // forex never
      { question: 2, answer: 21 }, // shares never
      { question: 3, answer: 32 }, // personalProfit score 3
      { question: 4, answer: 42 }, // useLeverage score 3
    ]
    expect((await apple.beforeSubmit!({ accountApplicationQuestionDetails: details }, questions)).appropriatenessLevel).toBe('REFER')
  })

  it('assessment questions show only when forexExperience === never', () => {
    const steps = buildUkSteps(questions)
    const apple = steps.find((s) => s.requiredQuestions?.includes('appleUseLeverage'))!
    expect(apple.shouldDisplay?.({ accountApplicationQuestionDetails: [{ question: 1, answer: 11 }] })).toBe(true)
    expect(apple.shouldDisplay?.({ accountApplicationQuestionDetails: [{ question: 1, answer: 12 }] })).toBe(false)
  })
})
