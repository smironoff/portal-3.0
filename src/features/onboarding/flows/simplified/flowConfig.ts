import type { StepField } from '../../engine/stepConfig'
import { PersonalInfoStep } from '../../steps/PersonalInfoStep'
import { PhoneStep } from '../../steps/PhoneStep'
import { PlatformStep } from '../../steps/PlatformStep'
import { TermsStep } from '../../steps/TermsStep'
import { AddressStep } from '../../steps/AddressStep'
import { makeQuestionStep } from '../../steps/QuestionStep'
import { useQuestionsList } from './useQuestionsList'

export const TMLC_QUESTIONS = {
  forexExperience: 'forexExperience',
  securitiesBondsExperience: 'securitiesBondsExperience',
} as const

export const LEVEL_ONE_STEPS: StepField[] = [
  { fields: ['accountHolderFirstName', 'accountHolderLastName', 'accountHolderDayOfBirth', 'accountHolderMonthOfBirth', 'accountHolderYearOfBirth'], component: PersonalInfoStep, category: 'personal', canGoBack: false },
  { fields: ['accountHolderPhone', 'accountHolderPhoneCode'], component: PhoneStep, category: 'phone', canGoBack: false },
  { fields: ['selectedPlatform', 'platformAccountType', 'leverage', 'accountCurrency'], component: PlatformStep, category: 'platform' },
  { fields: ['secondaryConsentAccepted'], component: TermsStep, category: 'terms', isLast: true },
]

export const LEVEL_TWO_STEPS: StepField[] = [
  { fields: ['accountHolderPostalCode'], component: AddressStep, category: 'address' },
  { fields: [], requiredQuestions: [TMLC_QUESTIONS.forexExperience], component: makeQuestionStep(TMLC_QUESTIONS.forexExperience, useQuestionsList), category: 'experience' },
  { fields: [], requiredQuestions: [TMLC_QUESTIONS.securitiesBondsExperience], component: makeQuestionStep(TMLC_QUESTIONS.securitiesBondsExperience, useQuestionsList), category: 'experience', isLast: true },
]
