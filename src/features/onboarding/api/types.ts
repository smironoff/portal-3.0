export type ApplicationStatus =
  | 'INCOMPLETE'
  | 'LEVEL1_APPROVED'
  | 'PENDING_KYC'
  | 'PENDING_REVIEW'
  | 'APPROVED'
  | 'DENIED'
  | 'FAILED'
  | string

export type QuestionsIDs = {
  question?: number
  answer?: number
  others?: string
}

export interface Answer {
  id: number
  answer: string
  other?: string
  label: string
  score?: number
}

export interface Question {
  id: number
  question: string
  label: string
  answers: Answer[]
  topic?: string
  isMandatory?: boolean
}

// Subset of the legacy AppInfo used by SimplifiedFlow L1 + L2.
export interface AppInfo {
  applicationId?: number
  completed?: boolean
  status?: ApplicationStatus
  accountHolderFirstName?: string
  accountHolderLastName?: string
  accountHolderTitle?: string
  accountHolderDayOfBirth?: number
  accountHolderMonthOfBirth?: number
  accountHolderYearOfBirth?: number
  accountHolderPhone?: string
  accountHolderPhoneCode?: number
  selectedPlatform?: string
  platformAccountType?: string
  leverage?: number
  accountCurrency?: string
  secondaryConsentAccepted?: string
  accountHolderPostalCode?: string
  accountHolderStreetAddress?: string
  accountHolderCity?: string
  accountHolderStateProvince?: string
  accountApplicationQuestionDetails?: QuestionsIDs[]
  appropriatenessLevel?: 'PASS' | 'REFER' | 'FAIL'
  [key: string]: unknown
}

export interface IncrementalSubmitResponse {
  applicationStatus: ApplicationStatus
  applicationId: number
  app_id?: number
}

export interface SubmitLevelResponse {
  applicationId: number
}
