import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useOnboardingStore } from '../state/onboardingStore'
import { makeQuestionStep } from './QuestionStep'
import type { Question } from '../api/types'

const question: Question = {
  id: 7,
  question: 'How much forex experience do you have?',
  label: 'forexExperience',
  answers: [
    { id: 11, answer: 'none', label: 'none' },
    { id: 12, answer: 'some', label: 'some' },
  ],
}

beforeEach(() => useOnboardingStore.getState().reset())

describe('QuestionStep', () => {
  it('renders the question and records the chosen answer', async () => {
    const onNext = vi.fn()
    const Step = makeQuestionStep('forexExperience', () => [question])
    render(<Step onNext={onNext} canGoBack />)
    await userEvent.click(screen.getByRole('radio', { name: /some/i }))
    await userEvent.click(screen.getByRole('button', { name: /continue/i }))
    expect(useOnboardingStore.getState().draft.accountApplicationQuestionDetails).toEqual([{ question: 7, answer: 12 }])
    expect(onNext).toHaveBeenCalled()
  })

  it('blocks advancing until an answer is selected', async () => {
    const onNext = vi.fn()
    const Step = makeQuestionStep('forexExperience', () => [question])
    render(<Step onNext={onNext} canGoBack />)
    await userEvent.click(screen.getByRole('button', { name: /continue/i }))
    expect(onNext).not.toHaveBeenCalled()
  })
})
