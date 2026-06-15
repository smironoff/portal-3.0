import type { StepField } from '../../../engine/stepConfig'
import type { AppInfo, Question } from '../../../api/types'
import { getUserAnswers, scoreAll } from '../../../engine/scoring'
import { TMCY, TMCY_QUESTION_LABELS, TMCY_PASS_THRESHOLD, TMCY_REFER_THRESHOLD, EMPLOYED_VALUES, TMCY_CONTACT_US_LINK } from '../constants'
import { PersonalInfoStep } from '../../../steps/PersonalInfoStep'
import { PhoneStep } from '../../../steps/PhoneStep'
import { AddressStep } from '../../../steps/AddressStep'
import { PlatformStep } from '../../../steps/PlatformStep'
import { TermsStep } from '../../../steps/TermsStep'
import { EmploymentStatusStep } from '../../../steps/EmploymentStatusStep'
import { EmployerInfoStep } from '../../../steps/EmployerInfoStep'
import { AnnualIncomeStep } from '../../../steps/AnnualIncomeStep'
import { SavingsStep } from '../../../steps/SavingsStep'
import { TaxInformationStep } from '../../../steps/TaxInformationStep'
import { makeQuestionStep } from '../../../steps/QuestionStep'
import { useQuestionsList } from '../../simplified/useQuestionsList'
import { makeAppFailed } from '../AppFailed'
import { ReferStep } from '../ReferStep'

const isEmployed = (draft: Partial<AppInfo>) =>
  EMPLOYED_VALUES.includes((draft.accountHolderEmploymentStatus as string) ?? '')

export const buildTmcySteps = (questions: Question[]): StepField[] => {
  const questionSteps: StepField[] = TMCY_QUESTION_LABELS.map((label) => ({
    fields: [],
    requiredQuestions: [label],
    component: makeQuestionStep(label, useQuestionsList),
    category: 'assessment' as const,
    ...(label === TMCY.describeHighVolatility
      ? {
          beforeSubmit: (draft: Partial<AppInfo>) => {
            const answered = getUserAnswers(questions, draft.accountApplicationQuestionDetails ?? [])
            const required = TMCY_QUESTION_LABELS.filter((l) => questions.some((q) => q.label === l))
            if (!required.every((l) => answered[l] !== undefined)) {
              throw new Error('All assessment questions must be answered before scoring')
            }
            const score = scoreAll(questions, draft.accountApplicationQuestionDetails ?? [])
            const appropriatenessLevel: 'PASS' | 'REFER' | 'FAIL' =
              score >= TMCY_PASS_THRESHOLD ? 'PASS' : score >= TMCY_REFER_THRESHOLD ? 'REFER' : 'FAIL'
            return { ...draft, appropriatenessLevel }
          },
        }
      : {}),
  }))

  return [
    { fields: ['accountHolderFirstName', 'accountHolderLastName', 'accountHolderDayOfBirth', 'accountHolderMonthOfBirth', 'accountHolderYearOfBirth'], component: PersonalInfoStep, category: 'personal' as const, canGoBack: false },
    { fields: ['accountHolderPhone', 'accountHolderPhoneCode'], component: PhoneStep, category: 'phone' as const },
    { fields: ['accountHolderPostalCode'], component: AddressStep, category: 'address' as const },
    { fields: ['taxIdentificationNumber', 'accountHolderNationality'], component: TaxInformationStep, category: 'tax' as const },
    { fields: ['selectedPlatform', 'platformAccountType', 'leverage', 'accountCurrency'], component: PlatformStep, category: 'platform' as const },
    { fields: ['accountHolderEmploymentStatus', 'employmentStatus'], component: EmploymentStatusStep, category: 'employment' as const },
    { fields: ['occupation', 'industry', 'employerName'], component: EmployerInfoStep, category: 'employment' as const, shouldDisplay: isEmployed },
    { fields: ['approximateIncomeValue'], component: AnnualIncomeStep, category: 'income' as const },
    { fields: ['estimatedNetWorth'], component: SavingsStep, category: 'income' as const },
    ...questionSteps,
    { fields: ['isReferAcknowledged'], component: ReferStep, category: 'refer' as const, canGoBack: false, shouldDisplay: (d) => d.appropriatenessLevel === 'REFER' },
    { fields: ['secondaryConsentAccepted'], component: TermsStep, category: 'terms' as const, isLast: true },
    { fields: [], component: makeAppFailed(TMCY_CONTACT_US_LINK), category: 'assessment' as const, isFailure: true },
  ]
}
