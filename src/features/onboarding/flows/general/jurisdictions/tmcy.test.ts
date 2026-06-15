import { describe, it, expect } from 'vitest'
import { buildTmcySteps } from './tmcy'
import type { Question } from '../../../api/types'

const questions: Question[] = [
  { id: 1, question: 'src', label: 'sourceWealth', isMandatory: true, answers: [{ id: 1, answer: 'a', label: 'a', score: 5 }, { id: 2, answer: 'b', label: 'b', score: 15 }] },
  { id: 2, question: 'vol', label: 'describeHighVolatility', isMandatory: true, answers: [{ id: 3, answer: 'a', label: 'a', score: 5 }, { id: 4, answer: 'b', label: 'b', score: 10 }] },
]

describe('buildTmcySteps', () => {
  it('includes a tax step, a Refer step (REFER shouldDisplay), terms (isLast), failure (isFailure)', () => {
    const steps = buildTmcySteps(questions)
    expect(steps.some((s) => s.category === 'tax')).toBe(true)
    expect(steps.some((s) => s.isLast)).toBe(true)
    expect(steps.some((s) => s.isFailure)).toBe(true)
    const refer = steps.find((s) => s.category === 'refer')
    expect(refer?.shouldDisplay?.({ appropriatenessLevel: 'REFER' })).toBe(true)
    expect(refer?.shouldDisplay?.({ appropriatenessLevel: 'PASS' })).toBe(false)
  })

  it('describeHighVolatility scores over ALL answers into the three bands', async () => {
    const steps = buildTmcySteps(questions)
    const scored = steps.find((s) => s.requiredQuestions?.includes('describeHighVolatility'))!
    expect((await scored.beforeSubmit!({ accountApplicationQuestionDetails: [{ question: 1, answer: 2 }, { question: 2, answer: 4 }] }, questions)).appropriatenessLevel).toBe('PASS') // 15+10=25
    expect((await scored.beforeSubmit!({ accountApplicationQuestionDetails: [{ question: 1, answer: 1 }, { question: 2, answer: 4 }] }, questions)).appropriatenessLevel).toBe('REFER') // 5+10=15
    expect((await scored.beforeSubmit!({ accountApplicationQuestionDetails: [{ question: 1, answer: 1 }, { question: 2, answer: 3 }] }, questions)).appropriatenessLevel).toBe('FAIL') // 5+5=10
  })

  it('scoring beforeSubmit throws when a required answer is missing', async () => {
    const steps = buildTmcySteps(questions)
    const scored = steps.find((s) => s.requiredQuestions?.includes('describeHighVolatility'))!
    // Only sourceWealth is answered; describeHighVolatility (also a required label present in questions) is missing.
    await expect(
      (async () => scored.beforeSubmit!({ accountApplicationQuestionDetails: [{ question: 1, answer: 1 }] }, questions))()
    ).rejects.toThrow('All assessment questions must be answered before scoring')
  })
})
