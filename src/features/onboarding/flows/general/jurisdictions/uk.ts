import type { StepField } from '../../../engine/stepConfig'
import type { AppInfo, Question } from '../../../api/types'
import { getUserAnswers } from '../../../engine/scoring'
import { UK, UK_CONTACT_US_LINK, EMPLOYED_VALUES } from '../constants'
import { forexAutoPass, computeUkLevel } from './ukScoring'
import { PersonalInfoStep } from '../../../steps/PersonalInfoStep'
import { PhoneStep } from '../../../steps/PhoneStep'
import { AddressStep } from '../../../steps/AddressStep'
import { PlatformStep } from '../../../steps/PlatformStep'
import { TermsStep } from '../../../steps/TermsStep'
import { EmploymentStatusStep } from '../../../steps/EmploymentStatusStep'
import { EmployerInfoStep } from '../../../steps/EmployerInfoStep'
import { SourceOfFundsStep } from '../../../steps/SourceOfFundsStep'
import { AnnualIncomeStep } from '../../../steps/AnnualIncomeStep'
import { SavingsStep } from '../../../steps/SavingsStep'
import { TaxInformationStep } from '../../../steps/TaxInformationStep'
import { makeQuestionStep } from '../../../steps/QuestionStep'
import { useQuestionsList } from '../../simplified/useQuestionsList'
import { makeAppFailed } from '../AppFailed'
import { ReferStep } from '../ReferStep'

const isEmployed = (draft: Partial<AppInfo>) =>
  EMPLOYED_VALUES.includes((draft.accountHolderEmploymentStatus as string) ?? '')

export const buildUkSteps = (questions: Question[]): StepField[] => {
  const noForex = (draft: Partial<AppInfo>) =>
    getUserAnswers(questions, draft.accountApplicationQuestionDetails ?? [])[UK.forexExperience]?.answerLabel === 'never'

  const assessment = (label: string, beforeSubmit?: StepField['beforeSubmit']): StepField => ({
    fields: [],
    requiredQuestions: [label],
    component: makeQuestionStep(label, useQuestionsList),
    category: 'assessment',
    shouldDisplay: noForex,
    ...(beforeSubmit ? { beforeSubmit } : {}),
  })

  return [
    { fields: ['accountHolderFirstName', 'accountHolderLastName', 'accountHolderDayOfBirth', 'accountHolderMonthOfBirth', 'accountHolderYearOfBirth'], component: PersonalInfoStep, category: 'personal', canGoBack: false },
    { fields: ['accountHolderPhone', 'accountHolderPhoneCode'], component: PhoneStep, category: 'phone' },
    { fields: ['accountHolderPostalCode'], component: AddressStep, category: 'address' },
    { fields: ['taxIdentificationNumber', 'accountHolderNationality'], component: TaxInformationStep, category: 'tax' },
    { fields: ['selectedPlatform', 'platformAccountType', 'leverage', 'accountCurrency'], component: PlatformStep, category: 'platform' },
    { fields: ['accountHolderEmploymentStatus', 'employmentStatus'], component: EmploymentStatusStep, category: 'employment' },
    { fields: ['occupation', 'industry', 'employerName'], component: EmployerInfoStep, category: 'employment', shouldDisplay: isEmployed },
    { fields: ['sourceOfFunds'], component: SourceOfFundsStep, category: 'income' },
    { fields: ['approximateIncomeValue'], component: AnnualIncomeStep, category: 'income' },
    { fields: ['estimatedNetWorth'], component: SavingsStep, category: 'income' },
    {
      fields: [],
      requiredQuestions: [UK.UKDepositLoss],
      component: makeQuestionStep(UK.UKDepositLoss, useQuestionsList),
      category: 'experience',
      shouldDisplay: () => questions.some((qn) => qn.label === UK.UKDepositLoss),
    },
    {
      fields: [],
      requiredQuestions: [UK.forexExperience],
      component: makeQuestionStep(UK.forexExperience, useQuestionsList),
      category: 'experience',
      beforeSubmit: (draft: Partial<AppInfo>) => {
        const level = forexAutoPass(getUserAnswers(questions, draft.accountApplicationQuestionDetails ?? []))
        return level !== undefined ? { ...draft, appropriatenessLevel: level } : draft
      },
    },
    assessment(UK.futuresOptionsExperience),
    assessment(UK.sharesFundsExperience),
    assessment(UK.personalProfit),
    assessment(UK.useLeverage),
    assessment(UK.unwantedMarketMovements),
    assessment(UK.appleUseLeverage, (draft: Partial<AppInfo>) => ({
      ...draft,
      appropriatenessLevel: computeUkLevel(getUserAnswers(questions, draft.accountApplicationQuestionDetails ?? [])),
    })),
    { fields: ['isReferAcknowledged'], component: ReferStep, category: 'refer', canGoBack: false, shouldDisplay: (d) => d.appropriatenessLevel === 'REFER' },
    { fields: ['secondaryConsentAccepted'], component: TermsStep, category: 'terms', isLast: true },
    { fields: [], component: makeAppFailed(UK_CONTACT_US_LINK), category: 'assessment', isFailure: true },
  ]
}
