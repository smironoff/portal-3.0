import { create } from 'zustand'
import type { AppInfo } from '../api/types'

interface OnboardingState {
  draft: Partial<AppInfo>
  currentStep: number
  patch: (partial: Partial<AppInfo>) => void
  setAnswer: (questionId: number, answerId: number, others?: string) => void
  setCurrentStep: (step: number) => void
  hydrate: (app: Partial<AppInfo>) => void
  reset: () => void
}

export const useOnboardingStore = create<OnboardingState>((set) => ({
  draft: {},
  currentStep: -1,
  patch: (partial) => set((s) => ({ draft: { ...s.draft, ...partial } })),
  setAnswer: (questionId, answerId, others) =>
    set((s) => {
      const existing = s.draft.accountApplicationQuestionDetails ?? []
      const next = existing.filter((a) => a.question !== questionId)
      next.push({ question: questionId, answer: answerId, ...(others ? { others } : {}) })
      return { draft: { ...s.draft, accountApplicationQuestionDetails: next } }
    }),
  setCurrentStep: (currentStep) => set({ currentStep }),
  hydrate: (app) => set({ draft: { ...app } }),
  reset: () => set({ draft: {}, currentStep: -1 }),
}))
