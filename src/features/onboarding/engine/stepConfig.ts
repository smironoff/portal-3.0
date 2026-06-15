import type { ComponentType } from 'react'
import type { AppInfo, Question } from '../api/types'

export type StepCategory =
  | 'personal'
  | 'phone'
  | 'platform'
  | 'terms'
  | 'address'
  | 'experience'
  | 'assessment'
  | 'employment'
  | 'income'

export interface StepComponentProps {
  onNext: (patch?: Partial<AppInfo>) => void
  onBack?: () => void
  canGoBack: boolean
}

export interface StepField {
  fields: Array<keyof AppInfo>
  requiredQuestions?: string[]
  component: ComponentType<StepComponentProps>
  category: StepCategory
  shouldDisplay?: (draft: Partial<AppInfo>) => boolean
  beforeSubmit?: (draft: Partial<AppInfo>, questions: Question[]) => Promise<Partial<AppInfo>> | Partial<AppInfo>
  isLast?: boolean
  isFailure?: boolean
  canGoBack?: boolean
}
