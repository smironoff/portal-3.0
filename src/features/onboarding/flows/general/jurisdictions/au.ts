import type { StepField } from '../../../engine/stepConfig'
import type { AppInfo, Question } from '../../../api/types'
import { scoreAssessment } from '../../../engine/scoring'
import { AU_KOQ_LABELS, AU_PASS_THRESHOLD, EMPLOYED_VALUES } from '../constants'
import { PersonalInfoStep } from '../../../steps/PersonalInfoStep'
import { PhoneStep } from '../../../steps/PhoneStep'
import { PlatformStep } from '../../../steps/PlatformStep'
import { AddressStep } from '../../../steps/AddressStep'
import { TermsStep } from '../../../steps/TermsStep'
import { EmploymentStatusStep } from '../../../steps/EmploymentStatusStep'
import { EmployerInfoStep } from '../../../steps/EmployerInfoStep'
import { SourceOfFundsStep } from '../../../steps/SourceOfFundsStep'
import { AnnualIncomeStep } from '../../../steps/AnnualIncomeStep'
import { SavingsStep } from '../../../steps/SavingsStep'
import { makeQuestionStep } from '../../../steps/QuestionStep'
import { useQuestionsList } from '../../simplified/useQuestionsList'
import { AppFailed } from '../AppFailed'

const isEmployed = (draft: Partial<AppInfo>) =>
  EMPLOYED_VALUES.includes((draft.accountHolderEmploymentStatus as string) ?? '')

export const buildAuSteps = (questions: Question[]): StepField[] => {
  const additional = questions.filter((q) => q.isMandatory === false)
  const additionalLabels = additional.map((q) => q.label)

  const koqSteps: StepField[] = AU_KOQ_LABELS.map((label) => ({
    fields: [],
    requiredQuestions: [label],
    component: makeQuestionStep(label, useQuestionsList),
    category: 'assessment' as const,
  }))

  // When the backend returns zero additional (non-mandatory) questions, `additional`
  // is empty and no scoring `beforeSubmit` is attached, so `appropriatenessLevel`
  // stays unset. This matches the legacy `completeGeneral`, which defaults the level
  // to PASS server-side / on submit rather than failing closed. We deliberately do
  // NOT invent a FAIL-closed policy here; confirming the backend default remains a
  // follow-up.
  const additionalSteps: StepField[] = additional.map((q, idx) => ({
    fields: [],
    requiredQuestions: [q.label],
    component: makeQuestionStep(q.label, useQuestionsList),
    category: 'assessment' as const,
    ...(idx === additional.length - 1
      ? {
          beforeSubmit: async (draft: Partial<AppInfo>, _qs: Question[]) => ({
            ...draft,
            appropriatenessLevel: (
              scoreAssessment(questions, draft.accountApplicationQuestionDetails ?? [], additionalLabels) >=
              AU_PASS_THRESHOLD
                ? 'PASS'
                : 'FAIL'
            ) as 'PASS' | 'FAIL',
          }),
        }
      : {}),
  }))

  return [
    { fields: ['accountHolderFirstName', 'accountHolderLastName', 'accountHolderDayOfBirth', 'accountHolderMonthOfBirth', 'accountHolderYearOfBirth'], component: PersonalInfoStep, category: 'personal' as const, canGoBack: false },
    { fields: ['accountHolderPhone', 'accountHolderPhoneCode'], component: PhoneStep, category: 'phone' as const },
    { fields: ['selectedPlatform', 'platformAccountType', 'leverage', 'accountCurrency'], component: PlatformStep, category: 'platform' as const },
    { fields: ['accountHolderPostalCode'], component: AddressStep, category: 'address' as const },
    { fields: ['accountHolderEmploymentStatus', 'employmentStatus'], component: EmploymentStatusStep, category: 'employment' as const },
    { fields: ['occupation', 'industry', 'employerName'], component: EmployerInfoStep, category: 'employment' as const, shouldDisplay: isEmployed },
    { fields: ['sourceOfFunds'], component: SourceOfFundsStep, category: 'income' as const },
    { fields: ['approximateIncomeValue'], component: AnnualIncomeStep, category: 'income' as const },
    { fields: ['estimatedNetWorth'], component: SavingsStep, category: 'income' as const },
    ...koqSteps,
    ...additionalSteps,
    { fields: ['secondaryConsentAccepted'], component: TermsStep, category: 'terms' as const, isLast: true },
    { fields: [], component: AppFailed, category: 'assessment' as const, isFailure: true },
  ]
}
