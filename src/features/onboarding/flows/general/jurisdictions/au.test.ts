import { describe, it, expect } from 'vitest'
import { buildAuSteps } from './au'
import type { Question } from '../../../api/types'

const additional: Question[] = [
  { id: 100, question: 'extra1', label: 'extra1', isMandatory: false, answers: [{ id: 1, answer: 'a', label: 'a', score: 3 }, { id: 2, answer: 'b', label: 'b', score: 6 }] },
  { id: 101, question: 'extra2', label: 'extra2', isMandatory: false, answers: [{ id: 3, answer: 'a', label: 'a', score: 2 }, { id: 4, answer: 'b', label: 'b', score: 5 }] },
]

describe('buildAuSteps', () => {
  it('produces a terms step (isLast) and a failure step (isFailure)', () => {
    const steps = buildAuSteps(additional)
    expect(steps.some((s) => s.isLast)).toBe(true)
    expect(steps.some((s) => s.isFailure)).toBe(true)
  })

  it('the last additional question carries a scoring beforeSubmit (PASS at >= 8)', async () => {
    const steps = buildAuSteps(additional)
    const scored = [...steps].reverse().find((s) => s.beforeSubmit)
    expect(scored).toBeTruthy()
    const passDraft = { accountApplicationQuestionDetails: [{ question: 100, answer: 2 }, { question: 101, answer: 4 }] }
    expect((await scored!.beforeSubmit!(passDraft, additional)).appropriatenessLevel).toBe('PASS')
    const failDraft = { accountApplicationQuestionDetails: [{ question: 100, answer: 1 }, { question: 101, answer: 3 }] }
    expect((await scored!.beforeSubmit!(failDraft, additional)).appropriatenessLevel).toBe('FAIL')
  })
})
