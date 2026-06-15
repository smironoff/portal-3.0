import { describe, it, expect } from 'vitest'
import { getUserAnswers, scoreAssessment, scoreAll } from './scoring'
import type { Question } from '../api/types'

const questions: Question[] = [
  { id: 1, question: 'Q1', label: 'a1', answers: [{ id: 11, answer: 'low', label: 'low', score: 2 }, { id: 12, answer: 'high', label: 'high', score: 5 }] },
  { id: 2, question: 'Q2', label: 'a2', answers: [{ id: 21, answer: 'no', label: 'no', score: 0 }, { id: 22, answer: 'yes', label: 'yes', score: 4 }] },
]

describe('scoring', () => {
  it('getUserAnswers maps answered details to label -> score', () => {
    const map = getUserAnswers(questions, [{ question: 1, answer: 12 }, { question: 2, answer: 21 }])
    expect(map.a1?.score).toBe(5)
    expect(map.a2?.score).toBe(0)
  })
  it('scoreAssessment sums scores over the given labels', () => {
    const details = [{ question: 1, answer: 12 }, { question: 2, answer: 22 }]
    expect(scoreAssessment(questions, details, ['a1', 'a2'])).toBe(9)
    expect(scoreAssessment(questions, details, ['a1'])).toBe(5)
  })
  it('treats unanswered/unknown labels as 0', () => {
    expect(scoreAssessment(questions, [], ['a1', 'a2'])).toBe(0)
  })
  it('scoreAll sums every answered question score', () => {
    const details = [{ question: 1, answer: 12 }, { question: 2, answer: 22 }] // 5 + 4
    expect(scoreAll(questions, details)).toBe(9)
  })
  it('scoreAll is 0 with no answers', () => {
    expect(scoreAll(questions, [])).toBe(0)
  })
})
