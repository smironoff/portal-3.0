import { describe, it, expect, beforeEach } from 'vitest'
import { useOnboardingStore } from './onboardingStore'

describe('onboardingStore', () => {
  beforeEach(() => useOnboardingStore.getState().reset())

  it('patches the draft with a shallow merge', () => {
    useOnboardingStore.getState().patch({ accountHolderFirstName: 'Jo' })
    useOnboardingStore.getState().patch({ accountHolderLastName: 'Lee' })
    expect(useOnboardingStore.getState().draft).toMatchObject({ accountHolderFirstName: 'Jo', accountHolderLastName: 'Lee' })
  })

  it('records a question answer and replaces an existing one for the same question', () => {
    useOnboardingStore.getState().setAnswer(7, 1)
    expect(useOnboardingStore.getState().draft.accountApplicationQuestionDetails).toEqual([{ question: 7, answer: 1 }])
    useOnboardingStore.getState().setAnswer(7, 2)
    expect(useOnboardingStore.getState().draft.accountApplicationQuestionDetails).toEqual([{ question: 7, answer: 2 }])
  })

  it('hydrate replaces the draft; reset clears it', () => {
    useOnboardingStore.getState().hydrate({ accountHolderFirstName: 'A' })
    expect(useOnboardingStore.getState().draft.accountHolderFirstName).toBe('A')
    useOnboardingStore.getState().reset()
    expect(useOnboardingStore.getState().draft).toEqual({})
  })
})
